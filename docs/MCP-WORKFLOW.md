# MCP analysis, recovery and live progress

Connect `https://autovision.dev/mcp` with an organization API key using remote Streamable HTTP MCP. The [judge's guide](JUDGES_FIELD_GUIDE.md#featured-demo-give-your-favorite-agent-vision-through-mcp) contains setup and a demonstration prompt.

## Readable result, detailed evidence

Analysis tools return a short text narrative of initial measurements, selected tools, rejected choices, follow-up evidence and the advisory review recommendation. Text does not serialize retained JPEG previews. Full measurements and the trace remain in `structuredContent` and private job history; clients may still choose to display that detailed JSON.

Single-pass analysis also returns `next_steps`: suggestions based on measured brightness, available OpenCV regions and organization-enabled tools. Suggestions do not execute additional work, change the inspection default or imply AI consent. A separate `inspect_scene` call explicitly delegates images to configured models; obtain approval and account for additional quota/cost.

## Live progress

Clients request progress with `params._meta.progressToken` on a tool call. Tokens can be strings or integers, including zero. AutoVision then returns an SSE response carrying request-scoped `notifications/progress` messages and the final tool response. Messages contain a monotonic progress counter and short stage/status descriptions, not image bytes or hidden reasoning. No total is promised because tools are selected dynamically.

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "inspect_scene",
    "arguments": {"frames": [{"image": "BASE64_JPEG", "at_ms": 0}]},
    "_meta": {"progressToken": "inspection-1"}
  }
}
```

The request must accept both `application/json` and `text/event-stream`. Without a progress token, existing JSON tool responses remain supported. Individual agent-client UIs decide whether/how to expose notifications; server support does not guarantee a visible progress widget in every client. Streaming connections are closed after completion/cancellation. Retrying creates another run and may consume quota.

## Rejected choices and budgets

Invalid/disabled tools, bad regions, and attempts to re-detect advisory Bedrock-only boxes become error tool results for the Decider. The failed choice appears in the trace and consumes one of the bounded tool attempts. Pre-execution validation rejection does not consume an additional image quota unit. Actual reserved work retains its existing usage accounting.

The Decider can select another permitted tool while attempts remain. It cannot finish successfully without at least one successful follow-up. Quota exhaustion, unavailable services/models, unsupported runtimes and timeouts still stop safely, retain initial evidence and recommend human review. The maximum remains two tool attempts and three planner turns within the existing inspection budget. Standalone tools called directly by an external agent return their own errors; that agent owns its cross-call budget.

## Verification

`tests/inspection.test.ts` covers rejected crop → error feedback → valid enhancement → final recommendation and attempt exhaustion. `tests/mcp-progress.test.ts` verifies progress before completion, token isolation, monotonic counters, image-free notifications and JSON compatibility. `tests/mcp-output.test.ts` checks readable prose without previews. These are deterministic protocol/orchestration tests, not labeled model-accuracy measurements.

The [agent workflow diagram](../public/agent-flow.svg) and [AWS architecture](AWS-ARCHITECTURE.md) show the implemented flow. For real-media evaluation, see [the evaluation procedure](evaluation/README.md).
