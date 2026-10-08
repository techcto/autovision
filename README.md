```text
  A   U   U TTTTT  OOO  V   V IIIII  SSSS IIIII  OOO  N   N
 A A  U   U   T   O   O V   V   I   S       I   O   O NN  N
AAAAA U   U   T   O   O V   V   I    SSS    I   O   O N N N
A   A U   U   T   O   O  V V    I       S   I   O   O N  NN
A   A  UUU    T    OOO    V   IIIII SSSS  IIIII  OOO  N   N

IMAGE PAIRS IN. ACTIONABLE SIGNALS OUT.
```

# AutoVision

[![CI](https://github.com/techcto/autovision/actions/workflows/ci.yml/badge.svg)](https://github.com/techcto/autovision/actions/workflows/ci.yml)
[![Open in GitHub](https://img.shields.io/badge/Open%20in-GitHub-181717?logo=github)](https://github.com/techcto/autovision)

AutoVision is an open-source image-comparison API that turns consecutive frames into motion observations. It combines a real OpenCV service with organization-scoped API keys, usage quotas, payment-plan plumbing, and a deployable AWS operating model.

[Website](https://autovision.dev) · [Source](https://github.com/techcto/autovision) · [Deployment guide](devops/cloudformation/README.md)

<a href="https://autovision.dev"><img src="assets/launch-website.svg" width="200" alt="Visit AutoVision" /></a>
<a href="https://aws.amazon.com/marketplace/pp/prodview-f4z2vbrqoh55u"><img src="assets/launch-marketplace.svg" width="200" alt="Subscribe to AutoVision on AWS Marketplace" /></a>
<a href="https://console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/create/review?templateURL=https://autovision-api.s3.us-east-1.amazonaws.com/cloudformation/autovision.yaml&amp;stackName=autovision"><img src="assets/launch-aws.svg" width="200" alt="Launch AutoVision with AWS CloudFormation" /></a>

## The Problem

Camera feeds produce far more footage than a person can continuously inspect. Applications need a small, predictable API that can turn image changes into structured observations without becoming a camera vendor or rebuilding a vision pipeline. AutoVision starts with a bounded, reproducible primitive: compare two images and return motion observations.

## Hackathon Pitch

**Image pairs in. Actionable signals out.** AutoVision makes computer-vision observations available as an API, while its sensor demonstration shows how an observation becomes a durable incident and an asynchronous email notification. The API is independently useful and can feed another incident-management application.

For the [AWS CDS Agentic AI Partner Hackathon](https://aws-cds-partner.devpost.com/), demonstrate the actual SES notification call with configured AWS permissions and verified sending identities. Local log-mode messages are not proof of production delivery. Include the architecture, a working demonstration, and judge-access instructions; do not claim future integrations as completed features.

## Try AutoVision

Open [autovision.dev](https://autovision.dev) and sign in with an account supplied by the deployment owner. Hosted launch credentials are private and are **not** the local development defaults. In SaaS mode, signup creates a personal workspace; private installations disable public signup and billing.

1. Open Settings and create an API key. Copy it when shown; only its hash is stored.
2. Send the synthetic image-pair request in the API section below.
3. Inspect the returned motion observations and usage.
4. Use **Run smoke sensor simulation** to explore the separate device-to-incident workflow.

The current hosted stack, `autovision-apphub-v011`, runs on the shared AppHub Fargate platform. The standalone CloudFormation template remains available for private installations. The stack-name suffix is historical; it is not a statement of the running release version.

## Core Capabilities

- Organization-scoped devices, observations, incidents, users, and settings.
- Deterministic demonstration rules for smoke, temperature, and CO readings; motion and person signals are also accepted.
- Asynchronous incident processing with optional Bedrock enrichment and configured SES email delivery.
- Bearer API keys revealed once at creation and stored as hashes.
- OpenCV image-pair motion comparisons with monthly usage accounting.
- SaaS and private-install modes using the same application images.
- Stripe Checkout and signed webhook integration, activated only after keys and price IDs are configured.

## Turnkey Platform

| Layer | Included capability |
| --- | --- |
| Web | Next.js/React console, workspace selection, devices, incidents, users, settings |
| API | Next.js route handlers under `src/app/api`, authentication, tenant-scoped operations |
| Worker | SQS incident processing, optional Bedrock assessment, configured email notification |
| Vision | Internal OpenCV service for consecutive image-pair motion detection |
| Persistence | DynamoDB, private S3 media storage, SQS and a dead-letter queue |
| Local runtime | Root Docker Compose, Dockerfiles in `devops`, DynamoDB Local and ElasticMQ |
| AWS runtime | ECS Fargate, ALB, IAM, CloudWatch, optional ACM HTTPS and Route 53 aliases |
| Delivery | GitHub Actions, versioned containers, S3 CloudFormation assets, Marketplace changesets |

AutoVision has web, API, worker, and vision images. The AWS worker task includes the vision sidecar.

## Local Development

Prerequisite: Docker with Compose. Use the wrapper to create the shared local network before starting the containers:

```bash
git clone https://github.com/techcto/autovision.git
cd autovision
cp .env.example .env
bash app.sh up
```

Open [http://localhost:8081](http://localhost:8081). Local username: `root`; local password: `autovision-local-change-me`. Change `AUTOVISION_ROOT_PASSWORD` and `AUTOVISION_SESSION_SECRET` before exposing the app outside your development machine. Local mode defaults to SaaS; AWS launch parameters choose the deployed mode independently.

```bash
curl --fail http://localhost:8081/api/health
docker compose ps
bash app.sh logs
# Stop containers without deleting data volumes:
bash app.sh down
```

Compose builds the web, API, and worker, plus the vision service. DynamoDB Local and ElasticMQ replace the cloud database and queue locally. Data volumes survive container restarts and `docker compose down`; do not use `down -v` unless intentionally discarding local data. AWS notification sending and Bedrock require separate configuration; local startup does not prove those integrations are enabled.

For source checks, install the Node.js version declared in `package.json`, then run:

```bash
npm ci
npm run typecheck
npm run test:web
bash git.sh audit
```

## API Examples

The web entry point routes `/api/*` to the API service. Replace local URLs with `https://autovision.dev` for an authorized hosted request. Health is public; other endpoints require their documented credentials.

### Compare a synthetic image pair

Create an API key in Settings, then supply it as `AUTOVISION_API_KEY` in your shell:

```bash
curl --fail-with-body http://localhost:8081/api/v1/detect \
  -H "Authorization: Bearer $AUTOVISION_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"demo":true}'
```

`demo:true` uses a synthetic pair. For real comparisons, send base64 image strings:

```json
{
  "image": "<base64-current-frame>",
  "previous_image": "<base64-previous-frame>"
}
```

The response contains motion observations. Requests require a valid organization-scoped key, are bounded to 4 MB at the API, and consume monthly quota. Free, Starter, and Scale quotas are 1,000, 10,000, and 100,000 comparisons/month. Private-install quota behavior differs from SaaS plans. Invalid keys return 401, exhausted quota returns 429, and an unavailable vision service returns 503. Arbitrary live video URLs are not accepted; a video adapter must sample frames and submit pairs.

## AWS Marketplace And Deployment

Subscribe through [AWS Marketplace](https://aws.amazon.com/marketplace/pp/prodview-f4z2vbrqoh55u) before launching images that require a subscription. The orange **LAUNCH AWS** button opens the standalone CloudFormation template; it does not subscribe you, select a network, or create a stack until you review and submit the parameters.

| Installation | Template |
| --- | --- |
| Standalone ALB and ECS cluster in an existing VPC | [`autovision.yaml`](devops/cloudformation/autovision.yaml) |
| Existing ALB/listener and ECS cluster, including AppHub | [`autovision-existing.yaml`](devops/cloudformation/autovision-existing.yaml) |

Provide VPC/subnets, root credentials, and a strong stable session secret. Private subnets need NAT or appropriate VPC endpoints. Use an ACM certificate covering `autovision.dev`; DNS aliases must be owned by the application template or a separate CloudFormation DNS stack. Filled parameter files and secrets must remain private.

Set `DeploymentMode=saas` for multi-workspace signup and billing or `on-premise` for a private workspace with billing disabled. Stripe requires `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_STARTER_PRICE_ID`, and `STRIPE_SCALE_PRICE_ID`; configuration must be validated in Stripe test mode before live payments.

The default cloud delivery path is EventBridge → SQS → worker. `EventBridgeEnabled=false` selects direct SQS; the current AppHub deployment uses this option. Local delivery uses ElasticMQ. Public release templates are stored in the existing `autovision-api` bucket; private evidence/media storage is separate.

See [DevOps](devops/README.md) and the [CloudFormation guide](devops/cloudformation/README.md) for publishing accounts, GitHub configuration, containers, release tags, and Marketplace delivery changesets.

## Operations And Recovery

Install, update, and delete AWS infrastructure through formal CloudFormation templates and reviewed change sets—not individual resource APIs or manual console deletion. Keep the shared platform until all attached application stacks are removed.

After deployment, verify TLS, `/api/health`, healthy ALB targets, stable ECS tasks, login, a synthetic observation, its incident, and worker logs. Email and AI need independent configured-path verification. Preserve provider/session secrets across relaunches or stored credentials may become unreadable.

Review each resource's deletion/retention policy before removing a stack. Export private configuration, back up actual data separately, test replacement compute, and perform traffic cutover through CloudFormation. A configuration export is not a data backup; do not assume retained resources have been imported into a replacement stack.

## Scope And Safety

- Implemented vision primitive: OpenCV motion comparison. No smoke/fire image classifier, COOL acceleration, or direct Ring integration is claimed.
- Sensor thresholds are demonstration rules, not certified alarms or life-safety equipment.
- Optional Bedrock failures do not prevent deterministic incident persistence.
- AgentCore runtime integration is not implemented in this repository.
- Demonstrations, fixtures, and screenshots must use synthetic data only.

## License

First-party code is [AGPL-3.0-or-later](LICENSE). Commercial and hosted use are allowed under its terms; modified network versions must offer Corresponding Source as required by the license. Third-party components retain their own licenses. Separate commercial terms for maintainer-owned code can be discussed through [commercial licensing](COMMERCIAL-LICENSE.md).

