# @thegreataxios/webmcp-core

Spec-aligned core for [W3C WebMCP](https://github.com/webmachinelearning/webmcp): `document.modelContext` polyfill, tool registry, custom elements, and local bridge client.

## Install

```bash
bun add @thegreataxios/webmcp-core
```

## Stable API

### Polyfill

```ts
import { installPolyfill, cleanupPolyfill, isNativeModelContext } from "@thegreataxios/webmcp-core";

installPolyfill(); // no-op when Chrome native WebMCP exists
// document.modelContext.registerTool(...)
cleanupPolyfill();
```

### Register tools (vanilla)

```ts
await document.modelContext.registerTool({
  name: "search",
  description: "Search the catalog",
  inputSchema: {
    type: "object",
    properties: { q: { type: "string" } },
    required: ["q"],
  },
  execute: async ({ q }) => ({
    content: [{ type: "text", text: `Results for ${q}` }],
  }),
}, { signal });
```

### Custom elements

```html
<webmcp-provider data-name="my-app">
  <!-- tools registered via React or imperative API -->
</webmcp-provider>
```

```ts
import { registerWebMCPElements } from "@thegreataxios/webmcp-core";
registerWebMCPElements();
```

### Bridge page client

Connect a tab to `@thegreataxios/webmcp-bridge` (no Chrome extension):

```ts
import { createPageBridgeClient } from "@thegreataxios/webmcp-core";

const client = createPageBridgeClient({
  url: "ws://127.0.0.1:17321/ws",
  token: process.env.WEBMCP_BRIDGE_TOKEN!,
});
client.connect();
```

## Experimental API

| Export | Purpose |
|--------|---------|
| `experimental_createJourneyRegistry` | Phase-scoped tool exposure |
| `experimental_defineJourney` | Register a journey definition |
| `setJourneyRegistry` / `getJourneyRegistry` | Wire journeys into polyfill filter |

Journeys map to W3C open discussion [#161](https://github.com/webmachinelearning/webmcp/issues/161). When any journey is active, only tools listed in active journeys are visible to agents.

## Testing shim

`navigator.modelContextTesting` is installed by the polyfill for local bridge and tests:

- `listTools()`
- `executeTool(name, argsJson)`
- `registerToolsChangedCallback(cb)`

## No Zod required

Tool inputs use **JSON Schema** on descriptors. Validation runs at registration (name pattern, description, serializable schemas).

## License

MIT
