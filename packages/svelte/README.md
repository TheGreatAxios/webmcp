# @thegreataxios/webmcp-svelte

Svelte 4 / 5 bindings for the [W3C WebMCP](https://github.com/webmachinelearning/webmcp) API.

## Install

```bash
bun add @thegreataxios/webmcp-svelte @thegreataxios/webmcp-core
```

## Quick Start

```svelte
<script lang="ts">
  import { createWebMCPProvider, useWebMCPTool } from "@thegreataxios/webmcp-svelte";

  createWebMCPProvider({ name: "shop", version: "1.0.0" });

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

- `createWebMCPProvider({ name, version })` / `getWebMCP()`
- `useWebMCPTool(options)` — auto-aborts on component destroy
- `useWaitForToolsUntil(promise)`
- `experimental_useWebMCPSync({ initial, tools })` — returns a Svelte `Readable<T>` store
- `experimental_useWebMCPJourney({ name, tools, active })`
- `experimental_useWebMCPBridge({ url, token })`

## License

MIT
