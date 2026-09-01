# @thegreataxios/webmcp-bridge

Local stdio MCP server that proxies tool calls to a browser tab over **localhost WebSocket**. Replaces the Chrome extension for Cursor and Claude Code.

## Install

```bash
bun add -g @thegreataxios/webmcp-bridge
openssl rand -hex 32
```

The installed CLI runs on Bun and requires a fixed
`WEBMCP_BRIDGE_TOKEN` of at least 32 characters.

## Cursor

Add a user-level MCP server so the token is not committed in a repository:

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

Cursor launches the single bridge process. Paste that same token into the page.
On start, the bridge reports only its local endpoint:

```
[webmcp-bridge] listening on ws://127.0.0.1:17321/ws
```

Pass the configured token to your app via `experimental_WebMCPBridgeProvider`
(React) or `createPageBridgeClient` (core).

## Security

| Control | Default |
|---------|---------|
| Bind | `127.0.0.1` only |
| Auth | Random token on WS handshake |
| Origin | `localhost` / `127.0.0.1` only |

Env:

- `WEBMCP_BRIDGE_PORT` — default `17321`
- `WEBMCP_BRIDGE_TOKEN` — required by the CLI; at least 32 characters
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
