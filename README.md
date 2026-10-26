# AutoVision

### Give your agent a reason to look again.

[![CI](https://github.com/techcto/autovision/actions/workflows/ci.yml/badge.svg)](https://github.com/techcto/autovision/actions/workflows/ci.yml)
[![Open in GitHub](https://img.shields.io/badge/Open%20in-GitHub-181717?logo=github)](https://github.com/techcto/autovision)

**A standalone OpenCV 5 service that turns visual evidence into an agent's next useful inspection—not just another caption.**

[Start the judge walkthrough](docs/JUDGES_FIELD_GUIDE.md) · [Technical README](README-TECHNICAL.md) · [AWS architecture](docs/AWS-ARCHITECTURE.md) · [Connect your agent](https://autovision.dev/docs/mcp) · [API reference](https://autovision.dev/api-reference)

<a href="https://autovision.dev"><img src="assets/launch-website.svg" width="200" alt="Try AutoVision live" /></a>

## From seeing something to knowing where to look next

An object detector can return a box. An AI model can describe a scene. Neither alone answers the next question: **would another look improve the evidence?**

AutoVision gives applications and agents reusable perception tools. OpenCV 5 measures objects, motion and brightness. An opt-in Bedrock Decider can choose to crop and re-detect a region, enhance a dark frame, or request a focused assessment. Actual tool results return to the Decider before its next choice.

**Perceive → Decide → Inspect → Evaluate → Inspect again or recommend human review.**

It does not identify intruders, determine intent, approve security actions, or replace certified alarms. Your application owns consequential actions and human approval.

## Try the real console

1. Open [AutoVision](https://autovision.dev) and sign in to your workspace.
2. Choose **Manual run** and supply an authorized image or short video. The browser samples bounded frames rather than uploading the original video.
3. Open the saved job to review detections, sample timestamps, measured activity and available AI context.
4. In **Settings → Object detection**, select the categories your application needs.
5. In **Settings → Autonomous inspection and vision lenses**, configure triggers, allowed tools, follow-up limits and approved model selectors. Enabling inspection requires explicit AI consent; Bedrock must be configured.

[View the signed-in console gallery](docs/console-gallery-final/README.md) · [Browse all screenshots locally](docs/console-gallery-final/index.html)

The gallery includes a real local OpenCV video analysis and actual settings controls. Local Bedrock was not configured during capture; those screenshots do not claim a fresh successful AI loop. Homepage demonstrations separately replay cached reports and are labeled accordingly.

## Give your favorite agent vision

Connect **`https://autovision.dev/mcp`** to an agent client supporting remote Streamable HTTP MCP with bearer-token authentication. Create an organization API key in Settings and keep it in your client's private credential configuration.

Ask the agent to discover `list_vision_lenses`, then use `inspect_scene` with an authorized image. Inspect the returned OpenCV measurements, selected tools and review recommendation—not just the agent's prose.

[Copy the MCP demo prompt and setup](docs/JUDGES_FIELD_GUIDE.md#featured-demo-give-your-favorite-agent-vision-through-mcp)

Clients must be able to provide image bytes as tool arguments. AutoVision does not fetch remote image URLs or read a client's file paths. Analysis consumes quota; optional Bedrock calls incur inference costs and require consent. External agents composing individual tools own their own cross-call limits.

## What makes it agentic?

The agent does not execute a fixed checklist regardless of the image. Measured objects and brightness inform its follow-up choice; actual follow-up evidence informs the next decision.

Our [recorded live trace](devops/testing/autonomous-inspection-live.json) captures a person detection, a crop re-detection miss, a subsequent scene assessment and a human-review recommendation. It preserves the disagreement and an unsupported phrase in the final advisory explanation. It is evidence of a real loop—not an accuracy benchmark or a guarantee that each run chooses identical tools.

[Inspect the workflow and evidence](docs/JUDGES_FIELD_GUIDE.md#the-perception-decision-action-loop)

## One service, different applications

- **Web console:** manual analysis, private job history, sample review and organization settings.
- **REST:** measured visual observations for ordinary application integrations.
- **MCP:** the same analysis and inspection tools for compatible agents.
- **Private AWS:** the same service can be installed in your own account using reviewed CloudFormation templates and authorized container access.
- **SmartDetector:** a separate consuming application supplying authorized camera samples and presenting observations on the web and Fire TV.

[SmartDetector](https://github.com/techcto/smartdetector) owns its Ring authorization and device experience. AutoVision remains independently usable without Ring, Fire TV or SmartDetector.

## Built with OpenCV 5 and AWS

OpenCV performs decoding, frame differencing, brightness measurement, pinned YOLOX detection, crop inspection and CLAHE enhancement. Bedrock supplies optional bounded planning and advisory assessments. Fargate, ALB, DynamoDB, SQS, IAM, Secrets Manager and CloudWatch provide the application runtime and operational foundation.

[AWS stack and design choices](docs/AWS-ARCHITECTURE.md) · [Agent workflow diagram](docs/JUDGES_FIELD_GUIDE.md#the-perception-decision-action-loop)

**Primary award focus: Agentic Vision. Additional path: Best Use of COOL.** Private templates support routing to a separately provisioned, licensed COOL/Graviton backend. Configuration alone is not proof of COOL execution or acceleration; runtime evidence and reproducible comparisons are separate requirements.

## Build, test and evaluate

[Technical setup and API examples](README-TECHNICAL.md) · [Local testing and Bedrock setup](docs/hackathon-local-testing.md) · [Private deployment guide](devops/cloudformation/README.md) · [Inspection contract](AUTONOMOUS_INSPECTION.md)

Dependencies and model assets are pinned. The technical README and field guide distinguish historical benchmarks, generated fixtures, deterministic planner tests and live model traces. Detector scores are not calibrated probabilities, sampled frames can miss activity, and model explanations can be wrong.

Private-install templates and release tooling are implemented and covered by deployment contract tests. The AutoVision Marketplace listing is not live; no public subscription or launch link is offered here.

## License

First-party code is [AGPL-3.0-or-later](LICENSE). Third-party components retain their own licenses. See [commercial licensing](COMMERCIAL-LICENSE.md) for separate terms available for maintainer-owned code.
