# @thegreataxios/webmcp-core

Headless, spec-aligned browser core for the [W3C WebMCP](https://github.com/webmachinelearning/webmcp) API (`document.modelContext`).

Wraps [`@w3c/webmcp-polyfill`](https://github.com/w3c-oss/webmcp-polyfill) in secure browser contexts, provides a spec-aligned fallback for non-secure/test DOMs, and adds stability tracking, cross-origin policy helpers, journey filtering, and the localhost bridge page client.

## Install

```bash
bun add @thegreataxios/webmcp-core
```

## Quick Start (Vanilla)

```ts
import { installPolyfill } from "@thegreataxios/webmcp-core";

installPolyfill(); // no-op if native document.modelContext is present

const controller = new AbortController();
await document.modelContext!.registerTool(
  {
    name: "search",
    title: "Search Catalog",
    description: "Search products by keyword",
    inputSchema: {
      type: "object",
      properties: { q: { type: "string" } },
      required: ["q"],
    },
    outputSchema: {
      type: "object",
      properties: { items: { type: "array" } },
    },
    annotations: { readOnlyHint: true },
    execute: async ({ q }, options) => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(String(q))}`, {
        signal: options?.signal,
      });
      return res.json();
    },
  },
  { signal: controller.signal },
);
```

## Discovering & Executing Tools

```ts
const tools = await document.modelContext!.getTools();
const rawJson = await document.modelContext!.executeTool(tools[0], { q: "boots" });
const result = JSON.parse(rawJson);
```

### Events & Stability

- `toolchange` — fired when tools are registered, unregistered, or journey-filtered.
- `toolactivated` (`ToolActivatedEvent`) — fired after a tool's `execute` callback is invoked.
- `toolcancel` (`ToolCancelEvent`) — fired when an in-flight tool execution's `AbortSignal` aborts.
- `document.modelContext.waitForToolsUntil(promise)` — signals async hydration stability (`awaitToolsStable()`).

## Bridge Page Client

```ts
import { createPageBridgeClient } from "@thegreataxios/webmcp-core";

const client = createPageBridgeClient({
  url: "ws://127.0.0.1:17321/ws",
  token: "your-32-plus-char-token",
});
client.connect();
```

Supports `sync_tools`, `execute_tool`, and `cancel_tool` (aborting in-flight tool executions cleanly).

## Experimental Exports

| Export | Purpose |
|---|---|
| `experimental_createJourneyRegistry` | Phase-scoped tool exposure |
| `setJourneyRegistry` / `getJourneyRegistry` | Wire journeys into tool discovery & bridge sync |

## License

MIT
