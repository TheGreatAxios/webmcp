# @thegreataxios/webmcp — Planning

Agent-native WebMCP toolkit aligned with the [W3C WebMCP](https://github.com/webmachinelearning/webmcp) spec. Spec-faithful core; better agentic UX via clearly marked `experimental_*` APIs.

## Naming (final)

**Scope:** `@thegreataxios`  
**Prefix:** `webmcp-*` (not `agent-*`) — ties to the W3C API (`document.modelContext`), discoverable, distinct from generic "agent" packages.

| Package | npm name | Role |
|---------|----------|------|
| Core | `@thegreataxios/webmcp-core` | Registry, polyfill, custom elements, experimental journeys |
| React | `@thegreataxios/webmcp-react` | Providers define, hooks consume |
| Bridge | `@thegreataxios/webmcp-bridge` | Local stdio MCP ↔ page WebSocket (no Chrome extension) |
| DevTools (later) | `@thegreataxios/webmcp-devtools` | Inspector, mock agent, replay |

### Custom elements (core)

| Element | Purpose | Spec |
|---------|---------|------|
| `webmcp-provider` | Polyfill + app identity | Stable |
| `webmcp-tool` | Register one tool | Stable |
| `webmcp-journey` | Phase-scoped tool exposure | `experimental_*` |

### React components

| Export | Purpose |
|--------|---------|
| `WebMCPProvider` | Root provider (wraps `webmcp-provider`) |
| `WebMCPTool` | Tool definition (wraps `webmcp-tool`) |
| `experimental_WebMCPJourney` | Journey scope |

### Hooks (consume only)

| Hook | Purpose |
|------|---------|
| `useWebMCP()` | Context: `available`, registry status |
| `useWebMCPSync()` | Bind store slice ↔ tool handlers + undo/audit |
| `experimental_useWebMCPJourney()` | Active journey, exposed tools |
| `experimental_useWebMCPConfirm()` | Pending HITL confirmations |

### Core functions

| Export | Purpose |
|--------|---------|
| `registerWebMCPElements()` | Register custom element definitions |
| `installPolyfill()` / `cleanupPolyfill()` | Spec-aligned polyfill lifecycle |
| `experimental_createJourneyRegistry()` | Journey state machine |
| `experimental_defineJourney()` | Declarative journey config |

### Bridge CLI

`webmcp-bridge` — stdio MCP server; binary from `@thegreataxios/webmcp-bridge`.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  App (React)                                                 │
│  WebMCPProvider / WebMCPTool / experimental_WebMCPJourney  │
│  useWebMCPSync / useWebMCP                                   │
├─────────────────────────────────────────────────────────────┤
│  @thegreataxios/webmcp-react                                 │
├─────────────────────────────────────────────────────────────┤
│  @thegreataxios/webmcp-core                                 │
│  webmcp-provider · webmcp-tool · webmcp-journey (exp)        │
│  registry · polyfill · experimental journey registry       │
├─────────────────────────────────────────────────────────────┤
│  document.modelContext (native Chrome | polyfill)            │
└───────────────────────────┬─────────────────────────────────┘
                            │ WebSocket (localhost only)
┌───────────────────────────▼─────────────────────────────────┐
│  @thegreataxios/webmcp-bridge                                │
│  stdio MCP ↔ WebSocket proxy                                 │
└───────────────────────────┬─────────────────────────────────┘
                            │
                     Cursor / Claude Code
```

**Pattern:** Providers/elements **define** tools and journeys. Hooks **consume** context, sync, and confirmations. No `useMcpTool` for definition.

**Schema:** JSON Schema default on descriptors. No required Zod peer dep. Optional Standard Schema adapters later.

## experimental_* policy

Mirrors React Router / Remix historical `unstable_*`:

- All non-W3C (or not yet in spec) APIs export with `experimental_` prefix.
- Document mapping to W3C open issues (e.g. journeys → [#161](https://github.com/webmachinelearning/webmcp/issues/161)).
- Breaking changes allowed in experimental without major semver on stable exports.
- Promotion path: experimental → stable when spec lands or pattern is proven.

**Stable (spec-aligned today):** `registerTool`, polyfill, `WebMCPTool`, JSON Schema inputs, `readOnlyHint` / `untrustedContentHint`.

**Experimental:** journeys, `useWebMCPSync`, HITL confirm, WebSocket transport binding, progress/streaming, page context resources.

## W3C standards track (separate from product)

| Library feature | W3C issue | Action |
|-----------------|-----------|--------|
| Journeys / skills | [#161](https://github.com/webmachinelearning/webmcp/issues/161) | Propose after library pattern validated |
| User elicitation / confirm | [#165](https://github.com/webmachinelearning/webmcp/issues/165) | Align HITL UI with spec discussion |
| Declarative forms | declarative-api-explainer | `webmcp-form` element when stable |
| Progress | MCP Progress + WebMCP open Q | `experimental_reportProgress` |
| Streaming | [#82](https://github.com/webmachinelearning/webmcp/issues/82) | Back burner |

## Bridge security (WebSocket transport)

**Threat model:** Local dev tool bridging desktop MCP client ↔ browser tab. Not a production remote deployment.

| Control | Implementation |
|---------|----------------|
| Bind address | `127.0.0.1` only — never `0.0.0.0` by default |
| Handshake token | Random token generated at bridge start; page must present token in first WS message |
| Origin check | Bridge validates `Origin` header on WebSocket upgrade (optional host allowlist) |
| No TLS on loopback | Acceptable for localhost; document never expose port publicly |
| Firewall | Default port `17321` (uncommon); env `WEBMCP_BRIDGE_PORT` |
| Tab isolation | Tool names `app:{name}` not `tab:{id}:{name}`; tab id metadata only in debug |

**Residual risk:** Any local process can connect to localhost WS if it guesses token — same class as Chrome extension + port 12315 today. Token in bridge stdout / env for page script injection via dev-only snippet.

**Not in scope:** Remote agents, multi-user server, auth beyond local token.

## Phases

| Phase | Ships | Gate |
|-------|-------|------|
| **P0** (this setup) | Monorepo, core polyfill stub, elements stub, react stubs, bridge stub, PLAN | `bun test` passes, packages build |
| **P1** | Spec-complete polyfill + `WebMCPTool` + bridge E2E in Cursor | Agent calls tool in tab without extension |
| **P2** | `experimental_WebMCPJourney` + `useWebMCPSync` | Buying flow: search → cart without checkout tools |
| **P3** | `experimental_useWebMCPConfirm` + devtools package | Destructive tool blocked without approve |
| **P4** | Declarative `webmcp-form` when W3C lands | Forms as tools |

## Tooling

- **Package manager:** Bun (workspaces, `bun test`, `bun run build`)
- **Build:** `tsup` (ESM + CJS + `.d.ts` for npm consumers)
- **Test:** `bun test` + happy-dom for core/react

## Repo layout

```
packages/
  core/       @thegreataxios/webmcp-core
  react/      @thegreataxios/webmcp-react
  bridge/     @thegreataxios/webmcp-bridge
```
