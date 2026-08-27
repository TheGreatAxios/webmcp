# @thegreataxios/webmcp-bridge

Local stdio MCP server that proxies tool calls to a browser tab over **localhost WebSocket**. Replaces the Chrome extension for Cursor and Claude Code.

## Install

```bash
bun add -g @thegreataxios/webmcp-bridge
# or use npx webmcp-bridge
```

## Cursor

`.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "webmcp": {
      "command": "webmcp-bridge"
    }
  }
}
```

On start, the bridge prints:

```
[webmcp-bridge] ws://127.0.0.1:17321/ws token=<hex>
```

Pass that token to your app via `experimental_WebMCPBridgeProvider` (React) or `createPageBridgeClient` (core).

## Security

| Control | Default |
|---------|---------|
| Bind | `127.0.0.1` only |
| Auth | Random token on WS handshake |
| Origin | `localhost` / `127.0.0.1` only |

Env:

- `WEBMCP_BRIDGE_PORT` — default `17321`
- `WEBMCP_BRIDGE_TOKEN` — optional fixed token
- `WEBMCP_BRIDGE_HOST` — must stay localhost

**Not for remote exposure.** Same threat model as local MCP + extension bridges.

## Protocol

1. Page connects to `ws://127.0.0.1:17321/ws`
2. Server sends `{ type: "auth_required" }`
3. Page sends `{ type: "auth", token }`
4. Page sends `{ type: "sync_tools", tools }` on register/`toolchange`
5. Bridge MCP `tools/list` returns synced tools
6. Bridge MCP `tools/call` → `{ type: "execute_tool" }` → page → `tool_result`

## Library usage

```ts
import { createMcpBridge } from "@thegreataxios/webmcp-bridge";

const bridge = await createMcpBridge();
console.log(bridge.token);
await bridge.connectStdio();
```

## License

MIT
