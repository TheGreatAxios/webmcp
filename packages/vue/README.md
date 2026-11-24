# @thegreataxios/webmcp-vue

Vue 3 Composition API bindings and plugin for the [W3C WebMCP](https://github.com/webmachinelearning/webmcp) API.

## Install

```bash
bun add @thegreataxios/webmcp-vue @thegreataxios/webmcp-core
```

## Quick Start

```vue
<script setup lang="ts">
import { provideWebMCP, useWebMCPTool } from "@thegreataxios/webmcp-vue";

provideWebMCP({ name: "shop", version: "1.0.0" });

useWebMCPTool({
  name: "search_catalog",
  title: "Search Catalog",
  description: "Search products by keyword",
  inputSchema: {
    type: "object",
    properties: { q: { type: "string" } },
    required: ["q"],
  },
  annotations: { readOnlyHint: true },
  handler: async ({ q }, options) => {
    const res = await fetch(`/api/search?q=${encodeURIComponent(String(q))}`, {
      signal: options?.signal,
    });
    return res.json();
  },
});
</script>
```

## Exports

- `createWebMCPPlugin({ name, version })` (`app.use(...)`)
- `provideWebMCP({ name, version })` / `useWebMCP()`
- `useWebMCPTool(options)` — auto-aborts on `onScopeDispose`
- `useWaitForToolsUntil(promise)`
- `experimental_useWebMCPSync({ initial, tools })` — returns a readonly Vue `Ref<T>`
- `experimental_useWebMCPJourney({ name, tools, active })`
- `experimental_useWebMCPBridge({ url, token })`

## License

MIT
