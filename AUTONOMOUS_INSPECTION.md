# Bounded autonomous inspection

REST `POST /api/v1/analyze` and MCP `analyze_image` / `analyze_video_frames` accept an optional `enhanced` boolean. `false` disables inspection; omission inherits the organization's default (initially disabled). `true` enables a bounded Bedrock-planned loop. **All enabled inspections require explicit `classify:true` AI consent**, even when enabled by an organization default. Invalid combinations fail before usage is charged. Existing single-pass analysis remains available.

```json
{
  "frames": [{"image": "BASE64_JPEG", "at_ms": 0}],
  "detection_labels": ["person", "dog", "cat", "package"],
  "classify": true,
  "enhanced": true
}
```

MCP additionally exposes `inspect_scene`, which takes supplied frames and optional detection labels and explicitly opts into AI and enhanced inspection. Its description discloses extra quota usage and retained private evidence. It does not retrieve remote media. MCP also exposes `inspect_region`, `enhance_low_light`, and `assess_scene` individually, using the same validated executor as the central planner. Supply frames and `frame_index`; crop also requires `detection_index`, and assessment accepts `focus`. They remeasure supplied frames, use organization settings, consume initial-frame quota plus one follow-up unit, and save private evidence. Crop/enhancement never invoke Bedrock; assessment explicitly opts into image delegation. Standalone responses use `tool_complete` and conservatively recommend review: the consuming agent owns the next decision and its cross-call budget. No arbitrary execution endpoints are exposed.

## Organization settings

Settings → Autonomous inspection provides a default-enabled toggle, person/dog/cat/package triggers, tool toggles, crop padding (0–0.5), low-brightness threshold (1–128 on a 0–255 gray scale), CLAHE strength (1–4), and a maximum of one or two follow-ups. Planner, scene, package and activity lenses have separate selectors for deployment-approved model keys. `deployment_default` uses `AUTOVISION_VISION_MODEL_ID`. Arbitrary customer model IDs, model downloads, URLs, and commands are not accepted.

## Central Decider and lens registry

One central Bedrock planner accumulates every actual tool result before making its next choice. Lenses do not recursively start agents. It can combine low-light evidence with focused package assessment, or crop/re-detection with activity assessment, within the same shared budget. These are separate passes on original supplied frames, not a chained pixel-transformation pipeline.

`assess_scene` accepts `focus: scene | package | activity`. These are specialized prompts and policies, not new trained detectors. A single frame cannot establish temporal motion. Operators register models with `AUTOVISION_AI_MODELS_JSON`, a JSON array of at most eight entries:

```json
[{"id":"scene_detail","label":"Approved detailed scene model","modelId":"YOUR_APPROVED_MODEL_OR_PROFILE","skills":["scene","package","activity"]}]
```

Allowed skills are `planning`, `scene`, `package`, `activity`. Registration does not verify regional availability, licenses, image/tool capabilities, IAM permissions or performance. Verify these before exposing a model, and manage AWS permission changes through CloudFormation. No subscriptions or resources are automatically provisioned.

API-key authenticated `GET /api/v1/lenses` and MCP `list_vision_lenses` discover the same catalog without inference or usage charges. The catalog distinguishes implemented lenses, separate opt-in face APIs, and planned OCR/segmentation/tracking/pose/alternative-detector adapters. Planned adapters cannot be selected as executable tools. This is a curated starting registry, not support for every popular model.

Dog and cat are YOLOX classes. Package remains advisory Bedrock grounding, not a specialized OpenCV package detector. Trigger labels must be selected in the detection policy. Measured low brightness also independently triggers inspection when low-light enhancement is enabled.

## Actual perception → tool → decision loop

1. Existing OpenCV 5 YOLOX processing measures objects, motion, and per-frame mean brightness. Existing optional Bedrock grounding identifies advisory packages.
2. For triggered inputs, Bedrock receives structured measurements and an allowlisted tool registry.
3. The planner requests one tool. The application validates the request, consumes one additional image quota unit, and executes it:
   - `inspect_region`: crops an existing detection, applies configured padding, and reruns OpenCV YOLOX. Returned boxes map to original-image coordinates; retained previews show the transformed image and are labeled accordingly.
   - `enhance_low_light`: applies OpenCV CLAHE to the luminance channel and reruns YOLOX. Requests above the configured darkness threshold are rejected. Contrast enhancement cannot recover missing details.
   - `assess_scene`: reruns OpenCV on one original supplied frame and requests its advisory Bedrock scene description.
4. Actual tool measurements return to Bedrock as a tool result. A subsequent planner call returns `finish` with a brief reason and `review_recommended` boolean. It cannot finish before a follow-up has executed successfully.

The loop uses at most two follow-ups, at most three planner calls, and a 35-second loop budget with bounded per-call timeouts. Initial single-pass processing is outside that budget. Follow-up execution and failed attempts after quota reservation are billed as image processing; planner calls are currently bounded but not separately metered as customer image units. Both the initial and follow-up OpenCV measurements must report version 5.0.0.

Results retain the initial observations plus `inspection.status`, `review_recommended`, `reason`, `followup_count`, and a trace of actual tool inputs, measurements, model completion, and elapsed time. No original frames or credentials are stored in the trace; small transformed sampled previews follow the existing job retention and purge policy. Job detail pages show the review recommendation and expandable tool evidence.

Unavailable models, malformed planner calls, timeouts, tool failures, and exhausted quotas preserve initial evidence and recommend human review. `tool_complete` is lens evidence without a central Decider recommendation. `not_triggered` is not proof that an object was absent. Review recommendations are advisory and **do not automatically suppress events, identify people, send notifications, or approve security actions**. SmartDetector can consume the flag in a separate integration; this change does not wire SMS/email or camera resampling.

## Evaluation

A real OpenCV 5/Nova run is captured in `devops/testing/autonomous-inspection-live.json`: initial full-frame person detection, a crop miss, another selected scene-assessment tool, and a human-review recommendation. This is an honest smoke-test projection, including an unsupported phrase in the planner reason, not an accuracy benchmark. The interactive homepage pipeline replays this cached artifact; newly uploaded media uses a real SSE pipeline with bounded public-demo allowance. Anonymous results are not persisted as private jobs.

For live events on authenticated REST requests, send `Accept: text/event-stream`. Events have stable step IDs within a run and types `run.started`, `step.added`, `step.started`, `step.completed`, `step.failed`, `run.completed`, `run.failed`. The Decider dynamically adds lens steps, and the final event carries the response. Cancellation aborts outstanding requests where supported. Streams do not resume; retrying creates a new run and can consume quota. Private model chain-of-thought is never emitted.

The four homepage clip reports can also contain cached inspection traces. Generate once against a configured localhost server with `AUTOVISION_RECORD_INSPECTION=true AUTOVISION_KEEP_POSTER=true node devops/testing/record-home-demo.cjs intruder` (or dognight/package/backyardintruder). Generation incurs inference cost; replay only reads the static report. Review-needed and over-budget outcomes are retained honestly rather than converted into successful traces. Valid model batches are executed sequentially within the same two-follow-up budget and returned together before the next Decider turn.

Run `npx tsx --test tests/inspection.test.ts tests/detection-contract.test.ts` for the consent, quota, compatibility, tool-feedback, invalid-request, and failure-handling checks. The planner tests use deterministic injected responses and must not be presented as live Bedrock evidence.

With the pinned OpenCV dependencies installed, run `PYTHONPATH=src/vision python -m unittest discover -s src/vision -p test_inspection.py -v` to verify actual OpenCV 5 CLAHE, crop bounds, and original-coordinate mapping. These transformation unit tests stub the detector output; YOLOX model integration is covered separately by the existing detector tests.

For hackathon evidence, run enhanced and single-pass analysis on consented, labeled day/night/person/pet/package clips. Export actual job traces, model/runtime versions, latency, quota use, and expected-versus-observed review decisions. Include unavailable-model and low-quota cases. Report task success and false review/false dismissal counts; do not treat detector scores or presence counts as calibrated accuracy. Live Bedrock and labeled-clip results must be collected before claiming an end-to-end evaluated demo. COOL/Graviton acceleration is not claimed by this feature.
