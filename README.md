```text
  A   U   U TTTTT  OOO  V   V IIIII  SSSS IIIII  OOO  N   N
 A A  U   U   T   O   O V   V   I   S       I   O   O NN  N
AAAAA U   U   T   O   O V   V   I    SSS    I   O   O N N N
A   A U   U   T   O   O  V V    I       S   I   O   O N  NN
A   A  UUU    T    OOO    V   IIIII SSSS  IIIII  OOO  N   N

GIVE YOUR APPLICATION A PAIR OF EYES.
```

# AutoVision

[![CI](https://github.com/techcto/autovision/actions/workflows/ci.yml/badge.svg)](https://github.com/techcto/autovision/actions/workflows/ci.yml)
[![Open in GitHub](https://img.shields.io/badge/Open%20in-GitHub-181717?logo=github)](https://github.com/techcto/autovision)

AutoVision is an open-source visual-analysis service for applications, camera adapters, and AI agents. Its local development build analyzes images and sampled video with OpenCV, adds Amazon Nova Lite scene summaries and advisory package boxes, and exposes the results through REST and MCP. SaaS and private installations share the same codebase.

[Website](https://autovision.dev) · [Source](https://github.com/techcto/autovision) · [Deployment guide](devops/cloudformation/README.md)

<a href="https://autovision.dev"><img src="assets/launch-website.svg" width="200" alt="Visit AutoVision" /></a>
<a href="https://aws.amazon.com/marketplace/pp/prodview-f4z2vbrqoh55u"><img src="assets/launch-marketplace.svg" width="200" alt="Subscribe to AutoVision on AWS Marketplace" /></a>
<a href="https://console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/create/review?templateURL=https://autovision-api.s3.us-east-1.amazonaws.com/cloudformation/autovision.yaml&amp;stackName=autovision"><img src="assets/launch-aws.svg" width="200" alt="Launch AutoVision with AWS CloudFormation" /></a>

## The Problem

Camera feeds produce far more footage than a person can continuously inspect. Applications need a small, predictable API that can turn image changes into structured observations without becoming a camera vendor or rebuilding a vision pipeline. AutoVision starts with a bounded, reproducible primitive: compare two images and return motion observations.

## Hackathon Pitch — OpenCV AI Competition 2026

**Give your application a pair of eyes.** AutoVision turns images and short clips into measurable visual signals: motion across time, pedestrian detections, and optional Nova Lite scene descriptions and package locations. Developers can use the same analysis through an interactive demo, REST API, or MCP tool instead of rebuilding a vision service for every application.

AutoVision is being prepared for the [OpenCV AI Competition 2026, powered by AWS](https://opencv26.devpost.com/). OpenCV performs the actual image processing; AWS supplies the deployment platform and optional Bedrock inference. The intended demonstration combines a camera-style clip, explainable results, private job history, and an agent consuming the same tools.

The core service uses **OpenCV 5.0.0** for image decoding, resizing, grayscale conversion, frame differencing, thresholding, changed-pixel measurements and JPEG previews. Pedestrian detection uses a separately isolated OpenCV 4.13 HOG adapter; its boxes are not described as OpenCV 5 object inference. Nova Lite supplies optional scene summaries and advisory package boxes. REST and MCP share this pipeline.

### Technical report and reproducible evaluation

AutoVision serves developers adding visual observations to camera, workflow and agent applications. Browser sampling keeps original video/audio local and sends bounded image samples. New jobs retain small sampled previews and structured observations for seven days, not the original clip. Settings includes organization-specific AI categories and a confirmed history purge; see [object detection and privacy](OBJECT_DETECTION.md). See the [architecture diagram](public/architecture.svg) and [editable source](devops/testing/architecture.mmd).

The synthetic evaluation uses five repetitions per two-frame 320×180 sequence. On local x86-64 Docker on October 9, 2026, measured changed-pixel fractions exactly matched generated masks: 0%, 5%, 50% and 100%. Median vision latencies, including pedestrian subprocess overhead, were 483, 448, 471 and 479 ms. These are machine-specific measurements, not throughput guarantees or real-world detector accuracy.

The lighting-change case documents a failure mode: brightness shifts trigger motion without proving an intruder. HOG can miss people and produce false positives. Nova grounding is advisory, not a calibrated probability; sampled frames can miss events. Smoke/fire require separate validation and cannot replace certified alarms. Embedded image instructions are untrusted.

Reproduce with `docker compose run --rm --no-deps autovision-vision python -m unittest discover -s src/vision -v` and `docker compose run --rm --no-deps autovision-vision python src/vision/evaluate.py`. Run `npm run test:mcp:local`; add `AUTOVISION_TEST_BEDROCK=true` when dedicated local credentials are configured.

Submission packaging includes the submitted revision, setup, report with representative-media evaluation, exported architecture, judge access and a public/unlisted video no longer than five minutes. Single-call classification does not establish the optional Agentic Vision award; COOL acceleration is not claimed. Follow the [requirements](https://opencv26.devpost.com/) and [rules](https://opencv26.devpost.com/rules). The page displays conflicting October 26 cutoff times; use the earlier 11:45 PM Pacific cutoff unless clarified.

## Try AutoVision

For the latest development demo, start the local stack below and open [localhost:8081](http://localhost:8081). Upload an image or short video, or click an illustrated sample clip. Enable Bedrock for scene summaries and package boxes when configured. See the local [API reference](http://localhost:8081/api-reference) and [MCP guide](http://localhost:8081/docs/mcp).

The hosted site is [autovision.dev](https://autovision.dev); its deployment may lag the local build. Sign in with an account supplied by the deployment owner. Hosted launch credentials are private and are **not** the local development defaults. In SaaS mode, signup creates a personal workspace; private installations disable public signup and billing.

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
- OpenCV motion measurements and pedestrian boxes for images and up to 12 sampled video frames.
- Optional Nova Lite summaries and advisory package boxes on the first, middle, and last supplied frames.
- REST and MCP analysis with shared API keys; session-authorized manual runs and private seven-day job history.
- SaaS and private-install modes using the same application images.
- Stripe Checkout and signed webhook integration, activated only after keys and price IDs are configured.

## Turnkey Platform

| Layer | Included capability |
| --- | --- |
| Web | Next.js/React console, workspace selection, devices, incidents, users, settings |
| API | Next.js route handlers under `src/app/api`, authentication, tenant-scoped operations |
| Worker | SQS incident processing, optional Bedrock assessment, configured email notification |
| Vision | OpenCV motion/pedestrian analysis plus optional Nova Lite object grounding |
| Persistence | DynamoDB job results/thumbnails, private evidence S3, SQS and a dead-letter queue; original demo videos are not stored |
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

Open [http://localhost:8081](http://localhost:8081). Local username: `root`; local password: `autovision-local-change-me`. Change `AUTOVISION_ROOT_PASSWORD` and `AUTOVISION_SESSION_SECRET` before exposing the app outside your development machine. Local mode defaults to a private installation: a demo homepage and one root user, with signup and billing disabled. AWS launch parameters choose the deployed mode independently.

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

- OpenCV motion/pedestrian analysis and optional Nova Lite package grounding are implemented and tested locally. Smoke/fire grounding is opt-in and advisory; no trained or validated smoke/fire detector, COOL acceleration, or direct Ring integration is claimed.
- Core processing uses OpenCV 5.0.0; isolated HOG uses OpenCV 4.13.0. Optional agentic-loop awards are not claimed.
- Sensor thresholds are demonstration rules, not certified alarms or life-safety equipment.
- Optional Bedrock failures do not prevent deterministic incident persistence.
- AgentCore runtime integration is not implemented in this repository.
- Demonstrations, fixtures, and screenshots must use synthetic data only.

## License

First-party code is [AGPL-3.0-or-later](LICENSE). Commercial and hosted use are allowed under its terms; modified network versions must offer Corresponding Source as required by the license. Third-party components retain their own licenses. Separate commercial terms for maintainer-owned code can be discussed through [commercial licensing](COMMERCIAL-LICENSE.md).

## Adding detection categories

AutoVision combines OpenCV motion/pedestrian measurements with optional Amazon Nova Lite image grounding. Package boxes are enabled with AI classification. They are labeled `source: bedrock`, `advisory: true`, with normalized `x/y/width/height`; no invented confidence score is returned. Nova checks the first, middle, and last supplied frames only (one image for an image job). `classification.checked_frames` reports their zero-based indices. Unchecked frames are not evidence of absence. Invalid AI JSON is rejected; measured OpenCV results remain available if AI fails.

For Docker, set `AUTOVISION_AI_DETECTIONS=package,smoke,fire` in your ignored `.env`, then recreate the web/API containers using the same Compose overrides you launched with. These are visual candidates, not verified fire/smoke alarms. Steam, fog, reflections, occlusion and illustrations can cause mistakes. With AI disabled or Bedrock unavailable, package/smoke/fire detection is unavailable—not a negative result. Original videos are not stored.

To add another AI category:

1. Add an allowlisted label and precise visible-evidence description in `src/lib/ai-detections.ts`.
2. Enable that label in the deployment environment; keep specialized categories opt-in.
3. Add positive and negative test images/clips, including confusing look-alikes, with permission to use the media. Evaluate box overlap, missed objects and false positives on representative cameras.
4. Verify REST, MCP, demo and private job history expose the same label, provenance and assessed frames. Run `npm run test:web` and `AUTOVISION_TEST_BEDROCK=true npm run test:mcp:local` against localhost.
5. For a dedicated OpenCV/ONNX model instead of AI grounding, select a suitably licensed model with the required trained classes; pin weights and checksum, preprocessing, class map and version. Adapt its outputs to the same normalized detection contract and validate detector-specific thresholds. A prompt label does not train a model.
6. Add temporal confirmation, representative validation and human review before connecting detections to SmartDetector actions. Smoke/fire vision must not replace certified physical detectors or emergency systems.

AWS deployments must pass these settings and scoped Bedrock permissions through CloudFormation and reviewed change sets. Local changes do not publish an updated Marketplace product.

Nova supports bounding-box image grounding: [AWS documentation](https://docs.aws.amazon.com/nova/latest/userguide/modalities-image.html).

## Feature map and integration boundaries

| Area | What AutoVision does |
| --- | --- |
| Public website and console | Public demo, SaaS signup, organization selection, API keys, usage/plans, settings, and private job history. Private installations disable public signup. |
| Image and sampled-video analysis | REST and MCP share bounded analysis; step through saved previews with normalized object boxes and sample timestamps. Original MP4s are not retained. |
| Object selection | Organization defaults and per-request `detection_labels` select from the catalog. Catalog entries do not imply a trained OpenCV detector for every category: the current measured detector is HOG person detection, with optional Bedrock grounding for selected additional labels. |
| Privacy | Purge saved analysis history and previews without deleting organizations or API credentials. Consumers such as SmartDetector have their own retention controls. |
| Optional face measurements | Separate authenticated, quota-metered `POST /api/v1/faces` returns face boxes and embeddings, without creating saved jobs or maintaining a face gallery. Requires operator-supplied models. |
| Deployment | Same web/API/worker/vision images support SaaS and private installations. CloudFormation controls AWS updates. COOL is optional configuration, not a demonstrated acceleration claim. |

## Faces: YuNet, SFace, and SmartDetector

YuNet and SFace are **model files**, not individual containers. OpenCV loads both inside the existing vision container. The whole-person detector answers “where is a person?”; the face path supplies measurements a consuming application can use for opt-in matching.

```text
Image → YuNet face box/landmarks → SFace aligned-face embedding
      → SmartDetector's encrypted location-specific household gallery
      → uncertain/known match → activity and notification preferences
```

- **YuNet:** locates faces and landmarks. Use a compatible dynamic-input export for this OpenCV 5 variable-resolution path; see the [official model documentation](https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet).
- **SFace:** converts an aligned face into a normalized 128-number signature. It does not know names. See the [official model documentation](https://github.com/opencv/opencv_zoo/tree/main/models/face_recognition_sface).
- **AutoVision:** computes and returns measurements. `/api/v1/faces` bypasses `runJob`, never stores its inputs/embeddings as analysis jobs, does not invoke Bedrock, and sends `Cache-Control: no-store`. Ordinary `/analyze` jobs still follow their normal retention policy.
- **SmartDetector:** owns names, consent, encrypted enrolled references, location isolation, matching, timelines and alert preferences. No gallery or customer identity database belongs in AutoVision.

The face response uses `{model_id, frames:[{at_ms, faces:[{box:{x,y,width,height}, embedding:[...128 numbers]}]}]}`. The model ID includes both weight checksums; embeddings from different IDs must not be compared. Boxes are normalized. Small/clipped faces are omitted. Scores are not identity probabilities, and the endpoint is not proof of identity or liveness.

### Configure and test face models

The standard vision image now downloads checksum-pinned official OpenCV Zoo weights **at build time**, including their MIT (YuNet) and Apache-2.0 (SFace) license notices. No separate face container or runtime download is needed. The manifest is in `src/vision/install_face_models.py`, pinned to Zoo revision `47534e27c9851bb1128ccc0102f1145e27f23f98`. Rebuild the vision image to include these models; existing production images are unchanged until released and deployed.

The Dockerfile configures the bundled models automatically. For custom read-only ONNX files, override:

```text
AUTOVISION_YUNET_MODEL=/models/yunet.onnx
AUTOVISION_YUNET_SHA256=<sha256 of the exact YuNet file>
AUTOVISION_SFACE_MODEL=/models/sface.onnx
AUTOVISION_SFACE_SHA256=<sha256 of the exact SFace file>
```

For ordinary local development, rebuild with `docker compose up --build` using your existing port/network overrides. For custom weights only, set `AUTOVISION_FACE_MODELS_DIR` to an existing directory containing `yunet.onnx` and `sface.onnx`, plus both SHA-256 variables, then add `-f docker-compose.faces.yml` to your compose file list. This override mounts files read-only and refuses to silently create a missing model directory. Do not commit personal footage, enrolled signatures or credentials. AWS image updates use a reviewed CloudFormation change set. Missing files, checksum mismatch, or unsupported runtime return unavailable rather than fabricated face results.

Call `POST /api/v1/faces` with an AutoVision bearer API key and the same `image` or ordered `frames` input as analysis, with `classify:false`. Limits are 1–12 frames, 30 seconds, JPEG/PNG, bounded request size; images consume the normal tenant quota. Treat returned embeddings as sensitive biometric data and do not log them in clients/proxies. The service cannot control retention by downstream clients or external infrastructure.

Verification includes authenticated-route/no-job tests, Python tests with synthetic model doubles, and real YuNet/SFace inference on an OpenCV sample: OpenCV 5.0.0 detected one face and returned a 128-dimensional embedding. This smoke check is not household accuracy or liveness validation; calibration and production deployment remain separate checks. Run `npm run test:web`, `npm run lint`, and the vision container's `python -m unittest discover -s src/vision -p 'test_*.py'` before release.

## OpenCV developer feedback

Future consumers could use the stateless measurements for building-access or attendance workflows while owning their own enrollment, consent and business rules. Those are not current AutoVision features. Access/attendance decisions would need representative validation, anti-spoof/liveness controls, audit/correction and an alternative such as a badge or PIN; a similarity score alone is insufficient.

The [friction log](FRICTION_LOG.md) records observed tasks, steps, expected/actual behavior, severity, workarounds and actionable suggestions. Include the sanitized log URL in the submission; recording it here does not submit it to Devpost automatically.

