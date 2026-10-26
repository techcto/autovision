# Agentic evaluation procedure

## Recorded live results — October 26, 2026

[Sanitized evaluation report](agent-evaluation.json): real OpenCV 5.0.0 and `us.amazon.nova-lite-v1:0` on three bundled public posters. All three loops completed, and all three recommended human review under the stated conservative policy. Initial expected visible-label matches were **2/3**. End-to-end times were **2.89 s, 6.46 s and 3.38 s** on this local setup; these are not AWS throughput measurements.

The night-dog case missed the expected dog label and the AI described a package instead. That is a perception/grounding failure, despite a successful tool loop and review recommendation. Its actual trace also demonstrates recovery: `inspect_region` rejected a Bedrock-only region, the error was returned to the Decider, `assess_scene` ran next, and `finish` completed with review recommended.

All cases expected review, so zero missed/unnecessary reviews in this small set does not establish specificity, calibrated accuracy or useful review discrimination. Initial evidence was retained in all three runs; no external action was implemented. The report identifies the runtime source revision and a dirty working tree because evaluation tooling was being finalized; the runtime application code was the v0.1.17 commit.

## Reproduction

The [three-case dataset](../../devops/testing/agent-evaluation-cases.json) labels visible objects in bundled public day/night person, dog and delivery images. Labels were assigned by maintainer visual review. The expected human-review flag is a conservative demonstration policy, not a safety ground truth. Three convenience samples do not establish population accuracy.

Run against a local stack with configured, approved Bedrock model access:

```sh
AUTOVISION_EVAL_AI_CONSENT=true AUTOVISION_EVAL_URL=http://localhost:8086 \
  node devops/testing/evaluate-agent.mjs
```

This explicitly approves image delegation and possible inference charges, consumes local public-demo allowance, and writes `docs/evaluation/agent-evaluation.json`. The report records source revision/dirty state, image hashes, actual runtime/model identifiers, measured label matches, loop completion, human-review policy matches, failure outcomes, tool statuses and elapsed time. It excludes image bytes and model prose.

An unavailable model must be reported as unavailable—not counted as a successful agent loop. The included report was produced by this command with approved local Bedrock credentials; no private credential values are included. The saved historical [live smoke trace](../../devops/testing/autonomous-inspection-live.json) remains separate from this evaluation. Deterministic regression tests validate recovery, budgets, observability and human-control boundaries but do not substitute for labeled live-agent evaluation. Minimal runtime containers without Git may supply `AUTOVISION_EVAL_REVISION` and `AUTOVISION_EVAL_DIRTY`; missing metadata is reported as unknown rather than discarding completed results.

All supplied cases expect review, so they cannot estimate unnecessary-review behavior on negative examples. Add separately reviewed empty-scene and clearly resolved cases before claiming specificity or calibrated review quality. Neither tool selection nor explanation alone proves causal improvement in visual accuracy. No physical or security action is executed by this loop.
