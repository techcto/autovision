# Stripe setup

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

Live keys additionally require `--live`. The script creates/reuses products,
monthly prices and sum meters using stable IDs, lookup keys and idempotency
keys. Conflicting resources fail for manual review. Partial creation is not
transactional: fix the problem and rerun. Copy returned price IDs into
STRIPE_STARTER_PRICE_ID and STRIPE_SCALE_PRICE_ID through deployment config.
Configure STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET separately; never commit
secrets. Verified subscription webhooks, not checkout redirects, activate plans.

## Usage preparation—not active overage billing

- `autovision_image_units_v1`: supplied frames plus charged follow-up passes.
  Do not count an entire video or API request as one image.
- `autovision_ai_credits_v1`: reserved for model-weighted AI usage. Weights,
  included AI allowances and overage prices are deliberately not defined yet.
- Meter payload: `stripe_customer_id`, integer `value`; aggregation: sum.

The script creates no metered prices, changes no subscriptions, and emits no
usage events. The current app still enforces calendar-month hard image quotas;
Bedrock token accounting is now instrumented separately; Stripe usage delivery
is not implemented. See [Goyal's handoff](GOYAL-HANDOFF.md) for coverage and tests.

Before enabling overages: persist organization/job/step usage and actual model
input/output tokens (including failed billable attempts); version AI credit
weights; align allowances with subscription billing periods; implement an
idempotent retryable usage outbox and reconciliation. Require customer opt-in,
spend caps and alerts before attaching approved metered prices. Never silently
upgrade existing subscribers to usage charges.

Track OpenCV image passes/compute separately from Bedrock model/token usage.
Premium models and agent loops can dominate variable costs; always-on compute,
load balancers and networking can dominate low-traffic costs. Cached demos
should generate no inference charges. Determine margins from measured workloads
and the actual AWS bill, not a flat per-request assumption.

Reference: https://docs.stripe.com/billing/subscriptions/usage-based
