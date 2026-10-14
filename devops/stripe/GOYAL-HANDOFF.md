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
- Stripe provisioning is offline by default; no usage export or charges occur.

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

## Still required before usage billing

- Durable image reservation events and correlation to failed jobs; image quota
  counters currently remain separate from this AI ledger. `usage_run_id` is
  returned for successful jobs; both completed and failed job records retain
  `usageRunId` for correlation.
- Anonymous public demo AI (initial call, each planner call and each follow-up)
  is bounded by publicBudget but is NOT assigned to customer billing scopes. Add separate operator cost accounting for that path.
- Add aggregate usage reporting UI/API; ledger records are not currently shown
  in the billing console. No estimated dollar costs are presented as actual.
- Confirm model/region/cache pricing and version credit conversion weights;
  decide included AI credits and overage prices. SDK retries can incur unknown
  cost not represented by a final successful response; reconcile with AWS.
- Implement an idempotent retryable Stripe usage outbox, subscription/customer
  mapping, reconciliation, billing-period alignment, and meter price attachment.
  Never use seven-day job retention as a billing source of truth.
- Customer overage opt-in, hard spending caps, alerts and financial retention/
  deletion policy review. Existing subscribers must not receive silent charges.

Production is unchanged. This is a foundation for testing, not completed
revenue-grade billing. Keep hard quotas and automatic overages disabled.
