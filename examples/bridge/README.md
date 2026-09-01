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
- Token entry persisted in localStorage
- Clear Cursor MCP setup copy
- Sample tools: `ping`, `echo`

## Cursor setup

1. Install the Bun CLI: `bun add -g @thegreataxios/webmcp-bridge`
2. Generate a token: `openssl rand -hex 32`
3. Add a user-level Cursor MCP server (do not commit the token):

```json
{
  "mcpServers": {
    "webmcp": {
      "command": "webmcp-bridge",
      "env": {
        "WEBMCP_BRIDGE_TOKEN": "<paste the generated token>"
      }
    }
  }
}
```

4. Restart that MCP server and paste the same token into the page
5. Ask Cursor to call `ping`

Cursor launches the only bridge process. The CLI never prints the token.

## Local without bridge

```js
await navigator.modelContextTesting.executeTool("ping", JSON.stringify({}));
```

Polyfill comes from `WebMCPProvider` — no manual `installPolyfill`.
