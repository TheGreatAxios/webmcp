# @thegreataxios/webmcp-bridge

Localhost MCP bridge connecting desktop AI clients (Cursor, Claude Code, etc.) to browser WebMCP tools over an authenticated localhost WebSocket — no Chrome extension required.

Available both as a **static Rust binary** (`apps/webmcp-bridge`, supporting `stdio` + Streamable HTTP `POST /mcp`) and as a **TypeScript library** (`@thegreataxios/webmcp-bridge`).

## Quick Start (Rust Binary — Recommended)

```bash
# Build release binary
cargo build --release -p webmcp-bridge

# Generate a 256-bit shared token
export WEBMCP_BRIDGE_TOKEN=$(./target/release/webmcp-bridge --generate-token)

# Run stdio MCP server + localhost WS relay (add --http-mcp for POST /mcp)
./target/release/webmcp-bridge --http-mcp
```

## Cursor MCP Configuration

Add to your user-level MCP config (never commit tokens to a repository):

```json
{
  "mcpServers": {
    "webmcp": {
      "command": "webmcp-bridge",
      "env": {
        "WEBMCP_BRIDGE_TOKEN": "<paste your 64-char hex token>"
      }
    }
  }
}
```

## Security Controls

| Control | Default |
|---|---|
| Bind host | `127.0.0.1` / `localhost` / `::1` only (non-local hosts rejected) |
| Auth | Required token (≥ 32 chars), constant-time verification on WS handshake |
| Origin | Exact `localhost` / `127.0.0.1` / `[::1]` origins only (or explicit `WEBMCP_BRIDGE_ORIGINS`) |
| Cancellation | Timed-out calls emit `cancel_tool` to abort in-flight browser handlers |

### Environment Variables / CLI Flags

| Env | Flag | Default |
|---|---|---|
| `WEBMCP_BRIDGE_HOST` | `--host` | `127.0.0.1` |
| `WEBMCP_BRIDGE_PORT` | `--port` | `17321` |
| `WEBMCP_BRIDGE_TOKEN` | `--token` | *(required, ≥ 32 chars)* |
| `WEBMCP_BRIDGE_ORIGINS` | `--allowed-origins` | localhost origins |
| — | `--http-mcp` | `false` (enables `POST /mcp`) |
| — | `--generate-token` | prints a 256-bit hex token and exits |

## Wire Protocol

1. Page connects to `ws://127.0.0.1:17321/ws`
2. Server sends `{ "type": "auth_required" }`
3. Page sends `{ "type": "auth", "token": "..." }` → server replies `{ "type": "auth_ok" }` (or closes `4401`)
4. Page sends `{ "type": "sync_tools", "tools": [...] }` on connect and `toolchange`
5. Bridge forwards `tools/call` → `{ "type": "execute_tool", "id", "name", "args" }` → page replies `{ "type": "tool_result", "id", "result" }`
6. On timeout or cancellation, bridge sends `{ "type": "cancel_tool", "id" }`

## License

MIT
