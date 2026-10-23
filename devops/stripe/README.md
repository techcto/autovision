# Stripe setup

AWS installs now load Stripe credentials through Secrets Manager in both
CloudFormation templates. See [credentials and SES installation](../cloudformation/README.md#credentials-ses-and-verified-saas-signup)
for stack-owned JSON credentials, an enterprise-owned secret ARN, optional KMS
and rotation rollouts. Use AutoVision's own Stripe account, price IDs and webhook
secret; never copy SmartDetector's credential values. Local development keeps
sandbox keys in an uncommitted `.env`. `StripeCredentialsRevision` rolls tasks
after rotation; updating the secret alone does not refresh running containers.

Prepared plans match the existing app: Dev is free with 1,000 image units;
Starter is $49/month with 10,000; Scale is $199/month with 100,000.
Private installs do not use Stripe.

Offline preview (no credentials or network):

```sh
node devops/stripe/setup-plans.mjs
```

Once keys are available, use a Stripe sandbox first:

```sh
node --env-file=.env.local devops/stripe/setup-plans.mjs --apply
```

Live keys additionally require `--live`. Reruns also keep each product's Checkout display current (name, description and the AutoVision logo, uploaded once to Stripe); prices are never changed. The script creates/reuses products,
monthly prices and sum meters using stable IDs, lookup keys and idempotency
keys. Conflicting resources fail for manual review. Partial creation is not
transactional: fix the problem and rerun. Copy returned price IDs into
STRIPE_STARTER_PRICE_ID and STRIPE_SCALE_PRICE_ID through deployment config.
Configure STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET separately; never commit
secrets. Verified subscription webhooks, not checkout redirects, activate plans.

## Usage-based overage (off by default)

- `autovision_image_units_v1`: image units beyond the plan allowance only.
- `autovision_ai_credits_v1`: model-weighted AI credits beyond the plan's
  included credits, only when `AUTOVISION_AI_CREDIT_WEIGHTS_JSON` is set.
- Meter payload: `stripe_customer_id`, integer `value`; aggregation: sum.

Metered overage prices are created only when you pass an amount in USD cents
(decimals allowed). In test mode first:

```sh
AUTOVISION_IMAGE_OVERAGE_UNIT_CENTS=0.5 node --env-file=.env devops/stripe/setup-plans.mjs --apply
```

Copy `STRIPE_IMAGE_OVERAGE_PRICE_ID` (and optionally `STRIPE_AI_OVERAGE_PRICE_ID`
with `AUTOVISION_AI_CREDIT_UNIT_CENTS`) into deployment config, then set
`AUTOVISION_USAGE_EXPORT=enabled`. Each organization still has to opt in on the
billing page, which attaches the overage price to its subscription. See
[Goyal's handoff](GOYAL-HANDOFF.md) for behavior, tests and what remains.

Track OpenCV image passes/compute separately from Bedrock model/token usage.
Premium models and agent loops can dominate variable costs; always-on compute,
load balancers and networking can dominate low-traffic costs. Cached demos
should generate no inference charges. Determine margins from measured workloads
and the actual AWS bill, not a flat per-request assumption.

Reference: https://docs.stripe.com/billing/subscriptions/usage-based
# Sandbox and checkout safeguards

Local Compose forces `AUTOVISION_STRIPE_MODE=sandbox`; live keys are rejected.
CloudFormation `StripeMode` defaults to `live` and is injected into web, API and
worker tasks. Use a separate AutoVision sandbox account and its own prices;
never copy SmartDetector credentials. Production keys remain in Secrets Manager.

Checkout and portal requests require a matching browser Origin and use the
canonical public origin for return URLs. Checkout validates the configured
monthly base price without changing AutoVision's image/AI overage pricing.
Per-workspace DynamoDB locking and persisted Stripe idempotency attempts prevent
duplicate subscriptions on retries. Existing non-canceled subscriptions must use
the portal. A completed checkout permits repurchase only when Stripe confirms
its workspace's old subscription is canceled or expired.

Production-built local SaaS signup can expose verification links only with the
complete isolated emulator configuration: local AWS credentials, the
`autovision-local` table, a loopback/local DynamoDB endpoint and
`AUTOVISION_LOCAL_REPLAY=true`. Compose supplies this boundary. AWS deployments
still require SES delivery; setting the replay flag alone does not bypass it.

For local billing, set `AUTOVISION_DEPLOYMENT_MODE=saas`, fill AutoVision's test
key and test price IDs in ignored `.env`, and run `stripe listen --forward-to
http://localhost:8081/api/billing/webhook`. Put that listener's signing secret
in `STRIPE_WEBHOOK_SECRET` and restart the local containers. Never use the live
webhook secret. These safeguards do not enable or change usage-based overages.
