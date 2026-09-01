# Tools example

Standalone demo of `WebMCPProvider` + `WebMCPTool`.

## Run

```bash
bun install
bun run build   # from monorepo root (packages)
cd examples/tools
bun run dev
```

Opens on **http://localhost:43110**.

## What it demos

- Provider installs the polyfill (no manual `installPolyfill`)
- `search` and `get_product` tools against a small catalog
- Last tool result rendered cleanly on the page

## Exercise tools

When the provider installs the polyfill, use the browser console:

```js
await navigator.modelContextTesting.listTools();
await navigator.modelContextTesting.executeTool(
  "search",
  JSON.stringify({ q: "mug" }),
);
await navigator.modelContextTesting.executeTool(
  "get_product",
  JSON.stringify({ id: "atlas-mug" }),
);
```

Browsers with native `document.modelContext` do not expose the polyfill-only
`navigator.modelContextTesting` API. Use a compatible agent or browser tool
client there instead.

Or connect via the bridge example + `webmcp-bridge` for Cursor / Claude Desktop.
