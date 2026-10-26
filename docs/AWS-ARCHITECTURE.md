# AutoVision — AWS architecture

[Project overview](../README.md) · [Technical README](../README-TECHNICAL.md) · [Judge's field guide](JUDGES_FIELD_GUIDE.md)

## Logical stack

![AutoVision AWS architecture](../public/aws-stack.svg)

[Download PNG](../public/aws-stack.png) · [Editable SVG](../public/aws-stack.svg) · [Diagram renderer](../devops/testing/export-architecture-diagrams.mjs) · [Mermaid overview](../devops/testing/architecture.mmd)

The diagram is a logical architecture, not a packet-level network map. The synchronous analysis path and asynchronous incident path are distinct. Not every request uses SQS, S3 or notifications.

## Request and processing paths

1. Web clients and REST/MCP applications enter through the HTTPS ALB. The web console and API are separate ECS Fargate services.
2. The API validates identity, organization access, payload limits, consent and quota. Standard vision uses an OpenCV sidecar; initial and follow-up measurements use the same pinned models.
3. Enhanced inspection optionally invokes the approved Bedrock planner and focused assessment models. Actual tool results return before the next decision. See the [agent diagram and evidence](JUDGES_FIELD_GUIDE.md#the-perception-decision-action-loop).
4. Tenant job records, settings and usage live in DynamoDB. Bounded previews/results and private evidence objects follow the relevant workflow's retention and access policies; original browser-sampled videos are not retained.
5. A separate incident-delivery path uses SQS and a worker with its own vision sidecar. Optional EventBridge routing and configured notifications are separate from ordinary synchronous analysis.

## Why these services?

| Layer | Decision and rationale |
| --- | --- |
| OpenCV 5 / pinned YOLOX | Reproducible image measurements and DNN detection rather than generative descriptions alone |
| Bedrock Converse | Managed model invocation and bounded tool-use orchestration; approved model availability and permissions remain operator responsibilities |
| ECS Fargate | Separate web/API/worker containers and Python vision sidecars without host management |
| ALB | HTTPS entry point, path routing and health-based distribution |
| DynamoDB | Organization-keyed jobs, settings and quota/usage records |
| SQS + DLQ | Decoupled background delivery and inspectable failure handling |
| Private S3 | Evidence-object storage where used; separate from public demo and release assets |
| IAM + Secrets Manager | Scoped task permissions and managed secrets outside source code |
| CloudWatch + inspection traces | Operational logs plus observable tool inputs/results, without exposing private chain-of-thought |
| CloudFormation | Formal installation, reviewed updates and deletion lifecycle |

## Deployment choices

| Installation | Template |
| --- | --- |
| Standalone ALB and cluster in an existing VPC | [autovision.yaml](../devops/cloudformation/autovision.yaml) |
| Existing cluster and HTTPS listener | [autovision-existing.yaml](../devops/cloudformation/autovision-existing.yaml) |

`DeploymentMode=saas` enables hosted-workspace signup and configured billing. `on-premise` runs a private installation with public signup and SaaS billing disabled. Private subnets need suitable NAT/VPC endpoint access. DNS, certificates, model permissions and container entitlement must be configured for the actual deployment.

Private-install templates and release tooling are built and deployment contract-tested. The AutoVision Marketplace listing is not publicly live; public buyer checkout and an independently verified new-buyer installation are not claimed. Follow the [deployment guide](../devops/cloudformation/README.md), not a public subscription/one-click launch link.

## Optional COOL / Graviton backend

`VisionBackend=standard` keeps bundled OpenCV sidecars. `VisionBackend=cool` removes the standard API/worker sidecars and routes vision calls to `CoolVisionUrl`, a separately provisioned, licensed private service on Graviton.

The templates do not create that host or subscribe/install COOL. Required service compatibility includes analysis/detection endpoints and health checks; agent transformations additionally need `/inspect`. Configuration is not execution evidence or proof of acceleration. Submit the COOL runtime/version, Arm host configuration, workload trace and identical-input baseline measurements separately. See the [COOL checklist](JUDGES_FIELD_GUIDE.md#additional-award-path-cool-on-private-aws).

## Security, observability and lifecycle

Templates include encrypted DynamoDB storage with point-in-time recovery, encrypted private S3 storage and managed deployment secrets. IAM, tenant isolation, consent, model selection, retention and operational access remain application/operator responsibilities. Infrastructure controls are not a certification or blanket proof of every deployment's configuration.

Analysis traces retain observable steps, durations, provenance and review outcomes—not private model reasoning. Do not log credentials, private image bytes or biometric embeddings. Quota, timeouts and tool limits bound work; uncertain or failed inspections preserve initial evidence and recommend human review.

All infrastructure changes use reviewed CloudFormation change sets. Review replacements, retained data, permissions and availability impacts. Preserve stable secrets across updates and independently verify health, login, model access, tenant boundaries and configured email delivery. No new AWS resources or production changes were made to produce this document.
