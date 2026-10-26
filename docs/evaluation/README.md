# Agentic evaluation procedure

The [three-case dataset](../../devops/testing/agent-evaluation-cases.json) labels visible objects in bundled public day/night person, dog and delivery images. Labels were assigned by maintainer visual review. The expected human-review flag is a conservative demonstration policy, not a safety ground truth. Three convenience samples do not establish population accuracy.

Run against a local stack with configured, approved Bedrock model access:

```sh
AUTOVISION_EVAL_AI_CONSENT=true AUTOVISION_EVAL_URL=http://localhost:8086 \
  node devops/testing/evaluate-agent.mjs
```

This explicitly approves image delegation and possible inference charges, consumes local public-demo allowance, and writes `docs/evaluation/agent-evaluation.json`. The report records source revision/dirty state, image hashes, actual runtime/model identifiers, measured label matches, loop completion, human-review policy matches, failure outcomes, tool statuses and elapsed time. It excludes image bytes and model prose.

An unavailable model must be reported as unavailable—not counted as a successful agent loop. No generated report is included until this command is actually executed. The saved historical [live smoke trace](../../devops/testing/autonomous-inspection-live.json) remains separate from this evaluation. Deterministic regression tests validate recovery, budgets, observability and human-control boundaries but do not substitute for labeled live-agent evaluation.

All supplied cases expect review, so they cannot estimate unnecessary-review behavior on negative examples. Add separately reviewed empty-scene and clearly resolved cases before claiming specificity or calibrated review quality. Neither tool selection nor explanation alone proves causal improvement in visual accuracy. No physical or security action is executed by this loop.
