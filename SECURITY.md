# Security policy

## Threat model

`@thegreataxios/webmcp-bridge` binds a WebSocket server to **localhost only**
(`127.0.0.1`, default port `17321`) and proxies tool calls from local MCP
clients into the connected browser page. The browser page executes tools with
the page's own privileges.

## Safeguards

- The server refuses to bind to non-localhost hosts.
- Every WebSocket connection must present the bridge token (`WEBMCP_BRIDGE_TOKEN`,
  minimum 32 characters) before syncing tools or executing calls.
- Non-localhost `Origin` headers are rejected with `403` by default; override
  only via `WEBMCP_BRIDGE_ORIGINS`.
- There is intentionally **no rate limiting or sandboxing** — the bridge trusts
  any holder of the token as the local user.

## Reporting

Do not open public issues for vulnerabilities. Contact the maintainer privately
(see `package.json` repository URL) and allow reasonable time to patch before
disclosure.
