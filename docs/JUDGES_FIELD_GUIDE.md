# AutoVision: judge's field guide and technical report

**Give your application a pair of eyes—and an agent a reason to look again.**

AutoVision is a standalone OpenCV 5 visual-analysis service on AWS. Developers use its web console, REST API, or MCP tools to turn supplied images and bounded video samples into measurements. An opt-in agent then selects additional inspection tools based on those measurements, receives their actual results, and decides whether to inspect again or recommend human review.

This guide maps the implementation and available evidence to the [OpenCV AI Competition requirements](https://opencv26.devpost.com/). It does not certify award eligibility or replace the submitted video and evaluation artifacts.

**Award focus:** Agentic Vision is the primary path; Best Use of COOL is an additional path through the private AWS backend option. Agent-loop evidence and COOL runtime/performance evidence are separate requirements.

## A five-minute judge walkthrough

1. Open [AutoVision](https://autovision.dev). The supplied homepage demonstrations replay cached reports; they are not fresh inference on each visit.
2. Show an authorized image or short clip in the live analysis workflow. Enable AI consent and enhanced inspection. Public live uploads have a bounded daily allowance; use an authorized private workspace if exhausted.
3. Identify the actual OpenCV runtime version, detected region or brightness measurement, and the tool selected by the Decider.
4. Expand the returned tool evidence. Show how a crop result, low-light measurement, or focused assessment informs the subsequent decision. Do not substitute a static summary for this step.
5. Show the review recommendation and a failure or disagreement case. Explain that a completed loop is not proof of a correct visual conclusion.
6. Show REST/MCP access and the AWS architecture. Close with the standalone/private deployment options and honest limitations.


## Featured demo: give your favorite agent vision through MCP

[Readable MCP results, live progress and rejected-tool recovery](MCP-WORKFLOW.md) · [Labeled live-evaluation procedure](evaluation/README.md).

Connect a client that supports **remote Streamable HTTP MCP with bearer-token authentication**. No AutoVision-specific agent framework is required. Client configuration and file access differ; not every chat attachment is accessible to MCP tools.

1. Sign in to [AutoVision](https://autovision.dev), create an organization API key in Settings, and copy it privately when shown.
2. Add a remote MCP server in your agent client:

   | Setting | Value |
   | --- | --- |
   | Name | `autovision` |
   | URL | `https://autovision.dev/mcp` |
   | Transport | Streamable HTTP |
   | Authentication | `Authorization: Bearer YOUR_AUTOVISION_API_KEY` |

   Store the key in the client's secret/environment facility, not a committed config file or chat message. This is API-key authentication, not an OAuth login flow. Private installs use their own HTTPS origin plus `/mcp`.
3. Refresh tool discovery and call `list_vision_lenses`. This lists available/planned lenses and approved model keys without inference or quota consumption.
4. Supply a small authorized JPEG/PNG through a client-supported local-file/base64 mechanism. AutoVision accepts image bytes, **not file paths or remote URLs**. Use the [MCP connection guide](https://autovision.dev/docs/mcp) for details.
5. Try the prompt below. Inspect the actual tool calls and the saved job, not only the agent's prose.

```text
Use AutoVision to inspect this authorized image. First list the available
vision lenses. I approve sending this image to the configured Bedrock models
for this demonstration. Use inspect_scene with the supplied image bytes as
one frame at at_ms 0. Show the measured OpenCV version and observations,
the actual follow-up tools and returned evidence, and the final human-review
recommendation. Separate measured facts from advisory model statements.
Do not infer identity, intent, or danger, and do not take external actions.
If no trigger occurs or a tool fails, report that honestly; do not invent a run.
```

`inspect_scene` delegates the bounded internal Decider loop to AutoVision. For a second, more advanced demo, the external agent can compose `analyze_image` with `classify:false, enhanced:false`, inspect its returned regions/brightness, and choose `inspect_region` or `enhance_low_light` using the supplied frames. It can explicitly request `assess_scene` when approved. These standalone tools use the same executor but the **external agent owns cross-call limits and the next decision**; ask it to perform no more than two follow-ups.

Analysis and follow-up calls consume image quota, can incur Bedrock costs when AI is used, and retain private job evidence. Ask permission before delegating images to an external model. Do not claim that the external client itself is bounded by AutoVision's internal two-follow-up budget.

**Video shot:** show the agent's MCP server connection with the token hidden, tool discovery, one authorized image, a real evidence-changing call sequence, and the review recommendation. Keep a cached replay visibly labeled if used as fallback.

## Problem, users, and impact

Camera integrations and agents need more than an image caption. They need measured evidence, a way to ask a useful follow-up question, and explicit handling of uncertainty. Rebuilding detection, image transforms, model access, retention, and tenant controls in every application creates duplicated work.

AutoVision serves application developers, camera-workflow builders, and agent developers. It separates reusable perception from the consuming application's policy. A home-monitoring application can present an uncertain event for review; an inspection application can use the same tools under its own validated decision policy. We do not claim quantified customer savings or validated safety outcomes.

## The perception-decision-action loop

![Evidence-driven inspection flow](../public/agent-flow.svg)

[Download the agent-flow PNG](../public/agent-flow.png).

```mermaid
flowchart TD
    I[Consented image or sampled video] --> P[OpenCV 5: objects, motion, brightness]
    P --> G{Enhanced inspection enabled and trigger measured?}
    G -->|No| R[Return initial evidence and explicit status]
    G -->|Yes| D[Bedrock Decider evaluates accumulated evidence]
    D --> T{Validated next tool}
    T --> C[inspect_region: crop OpenCV box and rerun YOLOX]
    T --> L[enhance_low_light: CLAHE and rerun YOLOX]
    T --> S[assess_scene: focused assessment with approved model]
    C --> E[Actual tool result: measurements and provenance]
    L --> E
    S --> E
    E --> B{Budget remaining?}
    B -->|Yes| D
    D -->|finish after a successful follow-up| H[Advisory human-review recommendation]
    B -->|No valid completion| F[Keep initial evidence and recommend review]
    T -->|Invalid request, quota or tool failure| F
```

**Perception:** OpenCV decodes and measures the supplied images. A detected object or measured darkness can trigger deeper inspection.

**Decision:** The Bedrock planner receives structured measurements and an allowlisted tool catalog. It chooses the frame, an existing detection where needed, and an assessment focus. It is not running a fixed list of tools unconditionally.

**Action:** The application validates and executes the chosen tool. A crop or enhancement performs new OpenCV work. A focused assessment uses the configured model for the selected scene, package, or activity lens. The result goes back to the planner, changing the evidence available for its next tool choice or review recommendation.

### Looking deeper and using different models

| Lens | What changes | Important boundary |
| --- | --- | --- |
| `inspect_region` | Crop an existing OpenCV detection with bounded padding; rerun YOLOX | Same pinned detector, not a newly trained model; advisory Bedrock boxes cannot be used as OpenCV regions |
| `enhance_low_light` | Apply CLAHE to luminance and rerun YOLOX | Only eligible dark frames; contrast enhancement cannot restore missing detail |
| `assess_scene` | Focus a model assessment on scene, package, or visible activity | Advisory output; a still image cannot establish motion or intent |
| `finish` | Return a bounded reason and `review_recommended` | Requires a successful follow-up; no identity, danger, or external security action |

Operators may register separate approved models for planning, scene, package, and activity through `AUTOVISION_AI_MODELS_JSON`; organization settings choose among those approved entries. The agent chooses a tool/focus, which resolves to its configured model. It does **not** download arbitrary models, tune weights, run an automatic model bake-off, or choose arbitrary provider endpoints. Registered models require independent capability, region, IAM, license, cost, and performance validation. OCR, segmentation, tracking, pose, and alternative detector adapters are explicitly planned, not executable today.

The loop allows at most two follow-ups and three planner calls within a 35-second inspection budget, in addition to initial analysis. Actual tool outputs are accumulated before the next planner turn. Follow-ups operate on original supplied frames; this is not a chained pixel-transformation pipeline.

Implementation: [planner and executor](../src/lib/autonomous-inspection.ts), [OpenCV transforms](../src/vision/inspection.py), [model/lens registry](../src/lib/vision-lenses.ts), [job orchestration](../src/lib/run-job.ts), [MCP tools](../src/lib/mcp.ts).

## Evidence that vision changes the next step

The [sanitized live smoke trace](../devops/testing/autonomous-inspection-live.json), recorded October 14, 2026, captures OpenCV 5.0.0, the pinned YOLOX detector, and `us.amazon.nova-lite-v1:0`:

| Stage | Actual recorded result | Subsequent behavior |
| --- | --- | --- |
| Full-frame perception | One person observed | Planner selected `inspect_region` using the measured region |
| Crop re-detection | Zero people returned; initial evidence retained | Planner subsequently selected `assess_scene` |
| Focused assessment | Person observed; no package returned | Planner finished with human review recommended |

This is a saved live run, not a scripted planner fixture. It demonstrates evidence feedback and bounded execution, but does not establish a counterfactual causal benchmark or detector accuracy. Its limitations are deliberately retained: the crop missed a person, and the planner's final package-uncertainty wording was not supported by the returned package detections. The current crop implementation has subsequently changed; the archived trace remains evidence of its recorded revision, not a guarantee of current output.

The deterministic [inspection tests](../tests/inspection.test.ts) separately assert that measured brightness changes tool selection and that a returned tool result informs the final review decision. Injected planner responses validate orchestration; they are **not** additional live model evaluations.

## OpenCV 5 implementation and evaluation

**October 26 live agent evaluation:** [report and methodology](evaluation/README.md) · [sanitized JSON](evaluation/agent-evaluation.json). Three actual OpenCV/Nova loops completed, including live recovery from a rejected Bedrock-box crop. Expected initial visible-label matches were 2/3; all three recommendations matched the conservative review policy. The missed dog and misleading package assessment are retained as failures. This small positive-only set does not establish general accuracy or false-review rates.

- Pinned Python package: `opencv-python-headless==5.0.0.93`; runtime checks require `cv2` engine version `5.0.0`. [Dependencies](../src/vision/requirements.txt).
- OpenCV performs decoding, resizing, grayscale conversion, frame differencing, thresholding, changed-pixel measurement, JPEG previews, DNN object detection, crop inspection, and CLAHE enhancement.
- YOLOX is a checksum-pinned OpenCV Zoo ONNX model, executed through `cv2.dnn`. See [object detection](../OBJECT_DETECTION.md) and [container build](../devops/docker/Dockerfile.vision).
- Nova supplies optional advisory scene/package/smoke/fire grounding. Those are not specialized validated OpenCV safety detectors. COOL/Graviton acceleration is not claimed.

Existing local x86-64 evaluation reported exact agreement with generated motion masks at 0%, 5%, 50%, and 100% changed pixels, and 77–79 ms median two-frame analysis on the measured machine. Recorded detector evaluation sampled 56 frames across supplied clips and a licensed street clip: person presence on backyard/doorbell/delivery clips was 11/11, 10/11, and 11/11 frames, and dog presence on the night clip was 8/11. The measured YOLOX median was 38 ms and p95 40 ms per 640-pixel frame. These historical local measurements are not current AWS latency promises, hand-labeled precision/recall, or agentic task-success rates. Details and reproduction commands remain in the [technical README](../README-TECHNICAL.md#technical-report-and-reproducible-evaluation).

### Evaluation and failure-handling matrix

| Question | Available evidence | Evaluation boundary |
| --- | --- | --- |
| Does the loop run and respect limits? | Saved live run; consent, quota, tool-feedback and budget tests | Historical runtime evidence; configuration and model behavior can change |
| Does evidence change later behavior? | Saved region → crop miss → scene-assessment sequence; deterministic feedback test | Observable evidence feedback, not a counterfactual causal benchmark |
| What happens on failure? | Tests for unknown/disabled tools, invalid regions, unsupported runtime/model, quota and planner failure | Initial evidence retained and human review recommended |
| Is a recommendation correct? | One live review recommendation with a documented unsupported phrase | No labeled agentic success rate is established |
| Can a judge inspect the process? | Structured trace, tool input/output, durations, model/runtime identifiers, SSE step events | Sanitized evidence, not private image content or credentials |
| Who controls consequences? | Consent, enabled-tool policy, bounded budget, advisory recommendation | Downstream application and human approval; no autonomous security action |

Do not infer success rates from unit-test counts. Distinguish completed execution, correct perception, appropriate review decisions, and latency. Brightness changes, shadows, night scenes, crop misses, occlusion, and ambiguous package grounding are useful failure cases.

## AWS architecture and why these choices

![AWS stack architecture](../public/aws-stack.svg)

[Download the AWS-stack PNG](../public/aws-stack.png). The AutoVision Marketplace listing is not yet live; private-install templates and deployment contract tests are available, but public buyer purchase is not claimed as verified.

[Dedicated AWS architecture and deployment rationale](AWS-ARCHITECTURE.md) · [Technical setup, API examples and evaluation](../README-TECHNICAL.md).

```mermaid
flowchart LR
    U[Web console / REST / MCP client] --> A[HTTPS Application Load Balancer]
    A --> W[Web task: Next.js UI]
    A --> API[API task: auth, quota, jobs, Decider]
    API --> V[OpenCV vision service]
    API --> B[Amazon Bedrock: approved models]
    API --> DB[DynamoDB: tenant jobs, usage and settings]
    API --> Q[SQS + dead-letter queue]
    Q --> WK[Worker task + vision sidecar]
    WK --> V2[OpenCV 5 processing]
    WK --> B
    WK --> DB
    WK --> N[Optional SES notification]
    API --> S3[Private evidence storage where used]
    CF[CloudFormation + IAM + Secrets Manager] -. configures .-> API
    CF -. configures .-> WK
    CW[CloudWatch logs] -. observes .-> API
    CW -. observes .-> WK
```

This is a logical diagram, not a packet-level network drawing. The synchronous API and asynchronous worker paths are distinct; not every analysis request passes through SQS, S3, or SES. The existing template places vision containers alongside API and worker tasks. See [templates](../devops/cloudformation/README.md) for the exact topology.

| Component | Why it fits AutoVision |
| --- | --- |
| OpenCV 5 + pinned ONNX assets | Reproducible local measurements and model execution rather than relying entirely on generative descriptions |
| Bedrock Converse/tool use | Managed model access for bounded evidence-driven planning and focused assessments; model access still needs deployment approval |
| ECS Fargate | Containerized Node and Python services without managing hosts; same images support hosted and private installs |
| ALB + HTTPS | Shared authenticated web/API/MCP ingress and health-based routing |
| DynamoDB | Tenant-keyed job records, usage counters, settings and lifecycle metadata; provisioned through CloudFormation |
| SQS + DLQ | Separate background incident delivery from interactive requests; inspect failed delivery instead of silently losing it |
| S3 | Private evidence-object storage where that workflow uses objects; public demo assets and release assets are separate from private uploads |
| IAM + Secrets Manager | Task-scoped AWS permissions and managed deployment secrets rather than credentials in the repository |
| CloudWatch + application traces | Runtime diagnostics plus structured step-level inspection evidence, without exposing hidden model chain-of-thought |
| CloudFormation + versioned releases | Reviewable create/update/delete lifecycle and reproducible infrastructure instead of ad hoc console changes |
| SES, optional EventBridge | Configured authentication/notification email and optional incident routing; not prerequisites for every vision call |

Templates include DynamoDB encryption and point-in-time recovery, encrypted private S3 storage, and managed secrets. These are template controls, not an independent security certification or proof that every deployment's parameters and permissions have been audited. AWS secures its managed infrastructure; the application operator remains responsible for IAM, secrets, tenant boundaries, model configuration, monitoring, and retention.

## Standalone, private AWS, REST, MCP—and SmartDetector

| Mode or consumer | Role |
| --- | --- |
| Hosted service | [autovision.dev](https://autovision.dev), with organization-scoped accounts and API keys |
| Private AWS installation | Deploy the same service into your own AWS account with `DeploymentMode=on-premise`; public signup and SaaS billing disabled |
| REST | Authenticated analysis and lens APIs for ordinary application integrations |
| MCP | Streamable HTTP tools for external agents; same measured pipeline and tenant-scoped credentials |
| SmartDetector | Separate application integrating camera samples, returned observations, review context, and a web/Fire TV user experience |

AutoVision does not require SmartDetector, a Ring camera, or Fire TV. SmartDetector owns its Ring authorization and presentation. The inspection loop returns evidence and recommendations; it does not itself unlock doors, identify intruders, resample a remote camera, or approve a security action. Deployment into a private account does not inherently make optional Bedrock processing local-only: image sharing still requires explicit consent and configuration.

## Additional award path: COOL on private AWS

Both CloudFormation templates implement `VisionBackend=standard|cool` and `CoolVisionUrl`. Standard mode uses the bundled OpenCV sidecars. COOL mode removes those API/worker sidecars and routes vision requests to a separately provisioned private backend intended for a licensed COOL Marketplace Graviton host. This lets application/API compute coexist with an Arm vision backend without claiming that the entire application runs on Arm.

The templates do not subscribe to Marketplace, install COOL, or provision that host. Selecting the backend is therefore deployment support—not proof of actual COOL execution. See the [backend guide](../devops/cloudformation/README.md#optional-cool-backend) and [template contract tests](../tests/deployment.test.ts).

For the additional award, attach:

- Actual COOL version/build, Marketplace entitlement/setup, Graviton instance type, Arm architecture, and deployment configuration.
- A sanitized runtime trace proving the claimed image/video operation executes through COOL, not the standard OpenCV fallback.
- Identical authorized inputs and operation settings for standard-versus-COOL comparisons, with warm-up policy, repetitions, concurrency, and environment recorded.
- Measured latency distributions, throughput and/or cost, including any unfavorable results. No acceleration factor is asserted without those measurements.
- Private networking and health checks, plus compatibility checks for `/analyze` and `/detect`. Agent crop/CLAHE tools also require `/inspect`; backend selection alone does not establish that compatibility.

No COOL execution trace or baseline comparison was found among the inspected repository evidence. If those artifacts exist in the private deployment, add their sanitized exports before presenting this award path as demonstrated. The recorded standard-backend agent trace and local YOLOX benchmark are not COOL evidence.

## Reproduce and verify

Follow [local setup and Bedrock credentials](hackathon-local-testing.md), [API/MCP examples](../README-TECHNICAL.md), and [deployment instructions](../devops/cloudformation/README.md). Keep secrets out of Git. Use Node.js as declared by `package.json` and the pinned Python dependencies.

```sh
npm ci
npm run typecheck
npm run test:web
npm run lint
npm run test:mcp:local
# Billable live inference: explicit opt-in, approved local credentials required.
AUTOVISION_TEST_BEDROCK=true npm run test:mcp:local
```

For actual image transforms, run the Python inspection tests with the pinned OpenCV environment. Those unit tests include stubbed detector outputs; separate detector integration checks exercise the pinned model. Preserve the command, source revision, input authorization/hash, runtime/model versions, outcome, duration, and quota consumption for any new benchmark. The evidence above distinguishes historical measurements from current runtime guarantees.

## Responsible operation and human control

Explicit `classify:true` consent is required for enhanced inspection. Payload, frame-count, tool, region, model, time, and quota boundaries constrain execution. Unknown tools and missing results cannot silently become negative detections. Failed inspection preserves initial evidence and recommends review.

Private jobs retain bounded sampled previews and traces under the seven-day policy; original video is not retained by the browser-sampling workflow. Purge and access rules remain authoritative. Public demo footage must be authorized for redistribution. Separate face APIs are sensitive opt-in measurements and are not part of this inspection loop. No identity, intent, danger, certified alarm, or automatic model-accuracy guarantee is claimed.
