# Bridge example

Connect Cursor (or Claude Desktop) to page tools via `webmcp-bridge`.

## Run

```bash
bun install
bun run build   # from monorepo root
cd examples/bridge
bun run dev
```

Opens on **http://localhost:43114**.

## What it demos

- `experimental_WebMCPBridgeProvider` + live connection status
- Token entry (or `?token=` query / localStorage)
- Clear Cursor MCP setup copy
- Sample tools: `ping`, `echo`

## Cursor setup

1. `bun add -g @thegreataxios/webmcp-bridge` then run `webmcp-bridge`
2. Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "webmcp": {
      "command": "webmcp-bridge"
    }
  }
}
```

3. Paste the printed token into the page (or open `http://localhost:43114/?token=…`)
4. Ask Cursor to call `ping`

## Local without bridge

```js
await navigator.modelContextTesting.executeTool("ping", JSON.stringify({}));
```

Polyfill comes from `WebMCPProvider` — no manual `installPolyfill`.
