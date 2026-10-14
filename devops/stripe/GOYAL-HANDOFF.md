# Usage accounting handoff

## Implemented locally

- Existing image quotas count input frames and reserved follow-up passes.
- REST/MCP/manual runJob calls now establish an isolated organization/run usage
  scope. Responses include `usage_run_id` for correlation.
- Bedrock SDK middleware records actual provider token usage for initial AI,
  planner calls, and focused AI lenses. Records contain model ID, timestamps,
  latency, cache token counts when reported, and SDK attempt count.
- A `started` record is persisted before inference. Terminal records are
  `complete` or `failed`; missing tokens and failed requests remain `unknown`,
  not zero. No images, prompts, model responses or credentials are stored.
- With AUTOVISION_TABLE, records use the existing table under
  `ORG#<orgId>` / `METER#<timestamp>#<eventId>`, without the media/job TTL.
  Without a table, accounting is bounded in-memory development-only storage.
- Ledger write failure before inference prevents that AI call. A failure after
  inference leaves its prior intent available for reconciliation. Optional AI
  failure handling retains original visual measurements.
- In SaaS mode every charged image unit (supplied frame or follow-up pass) is
  also an `image` METER record, written in the same DynamoDB transaction as the
  quota counter and tied to the run's `usage_run_id`. Private installs only
  count. Transactions use the existing PutItem/UpdateItem permissions.
- Anonymous public demo inference is recorded under the operator scope
  `operator.public-demo`, never a customer organization.
- Subscription webhooks store `currentPeriodStart`/`currentPeriodEnd` from the
  Stripe subscription item.
- SaaS `GET /api/v1/usage` and the billing page show measured totals for the
  Stripe period (calendar month until a paid period exists): image units and
  per-model Bedrock calls, tokens and unknown-usage calls. No prices or estimates.
- Usage-based overage (off by default, see below). With it disabled, nothing is
  exported or charged and ledger records stay `stripeStatus: not_exported`.

## Usage-based overage

Requires all of: `AUTOVISION_DEPLOYMENT_MODE=saas`, `AUTOVISION_USAGE_EXPORT=enabled`,
`STRIPE_IMAGE_OVERAGE_PRICE_ID`, a paid subscription and an admin opt-in on the
billing page. Missing any one keeps today's hard plan quota.

- Quota and billing share one window: paid subscriptions with a stored Stripe
  period count per period (`USAGE#P<periodStart>`), others per calendar month.
  When a period is first stored the counter starts fresh once.
- Opt-in sets a hard cap per period and attaches the metered overage price(s) to
  the Stripe subscription (idempotent). The setting is saved only if Stripe
  accepts the item. Opting out restores the hard plan stop.
- Only usage beyond the allowance is billed: image units above the plan
  allowance, and AI credits above `included_credits` for the plan. Included
  usage is never sent to Stripe. Each image record stores the quota counter it
  was charged against (`quotaKey`), and overage is computed per counter, so
  billing always matches what the quota enforced (records from before a
  period was stored are never overage).
- AI credits use versioned weights in `AUTOVISION_AI_CREDIT_WEIGHTS_JSON`. No
  defaults: without weights AI usage is reported as unpriced and never billed.
- The worker exports every few minutes (`AUTOVISION_USAGE_CYCLE_SECONDS`): one
  meter event per ledger record, `identifier` = record ID, so retries and
  duplicates never double count. Failures stay pending with an attempt count.
  Overage consumed before an opt-out is still exported.
- Hourly reconciliation logs differences between exported ledger values and
  Stripe meter summaries (Stripe aggregates with a short delay).
- Alerts email notification recipients once per threshold per period at the
  chosen percentages of the plan allowance and, when opted in, the cap.
- The billing page shows measured usage, overage units, export status and the
  overage form. No dollar estimates are shown.

## Goyal's test checklist

1. Run `npm run typecheck`, `npm run test:web`, and
   `node --test devops/stripe/setup-plans.test.mjs`.
2. Run a real classify-only upload and an enhanced person-triggered upload.
   Query the run's METER records; compare model/token numbers with SDK responses.
3. Verify every planner/focused-lens call is recorded, and concurrent tenants
   cannot mix organization IDs. Confirm cached demos create no inference entries.
4. Test unavailable Bedrock, timeouts, invalid AI output, and storage failure.
   Unknown usage must require reconciliation, never automatically mean zero.
5. Check ECS task permissions allow existing-table PutItem; all deployment and
   permission changes must use reviewed CloudFormation change sets.
6. Provision Stripe sandbox plans with the documented command. Verify reruns,
   checkout and signed webhooks. Never use production keys for this test.
7. In SaaS mode, run a job and confirm its `image` METER record matches the
   frames charged, then check the billing page totals and the stored period.
8. Stripe test mode only: create overage prices with
   `AUTOVISION_IMAGE_OVERAGE_UNIT_CENTS=<cents> node --env-file=.env devops/stripe/setup-plans.mjs --apply`,
   set `STRIPE_IMAGE_OVERAGE_PRICE_ID` and `AUTOVISION_USAGE_EXPORT=enabled`,
   opt in on the billing page, exceed the allowance, and confirm the meter
   events, reconciliation and the upcoming invoice in the Stripe dashboard.
9. Test opt-out, cap stop, worker retry after a Stripe outage, and alert emails.

Verified in Stripe test mode (2026-10-14, AutoVision sandbox): opt-in attached
the metered price; with synthetic local usage seeded to 9,998, a real 4-frame
job billed exactly 2 overage images; reconciliation showed ledger 2 = Stripe 2;
the invoice preview showed Starter $49.00 + 2 × $0.005; the cap refused usage
beyond 10,100. Not yet tested: alert emails through SES, worker retry against a
real Stripe outage, AI credit export (needs Bedrock and approved weights).

## Still required before enabling in production

- Decide overage prices, AI credit weights and included AI credits; confirm
  model/region/cache pricing. SDK retries can incur cost not represented by a
  final successful response; reconcile with the AWS bill.
- Customer terms for usage-based charges and the opt-in wording; existing
  subscribers must not receive silent charges (opt-in is per organization).
- Financial retention/deletion policy review (METER records have no TTL).
- Separate operator cost reporting for the `operator.public-demo` scope.
- Live rollout: create live overage prices deliberately with `--apply --live`,
  then set the parameters through a reviewed CloudFormation change set.

Production is unchanged. Usage-based overage ships disabled; keep it disabled
in production until the items above are decided and tested in Stripe test mode.
