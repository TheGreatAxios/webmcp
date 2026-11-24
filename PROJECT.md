# webmcp — Architecture & Design

Community implementation of the [W3C WebMCP](https://github.com/webmachinelearning/webmcp) API, combining a lightweight TypeScript browser core + framework adapters with a layered Rust MCP bridge.

## Workspace Split

### 1. Rust Off-Browser Core (`Cargo.toml`, `arch-rules.toml`)

Enforced by `crates/arch-lint` (`cargo run -p arch-lint -- check`):

- **L1 (zero I/O, no `tokio`/`axum`/`clap`/`rand`):**
  - `webmcp-protocol`: canonical tool types, wire messages, validation, `BridgeHub` port trait.
  - `webmcp-policy`: localhost-only bind invariants, origin allowlists, two-sided cross-origin visibility, journey state machine.
- **L2 (concrete I/O adapters, depend only on L1, isolated from each other):**
  - `webmcp-auth`: CSPRNG token generation, constant-time verification, env loading.
  - `webmcp-ws`: localhost Axum WebSocket relay + `PageSessionHub` implementing `BridgeHub`.
  - `webmcp-mcp`: MCP JSON-RPC 2.0 server (`stdio` + Streamable HTTP `POST /mcp`).
- **L3 (composition root):**
  - `apps/webmcp-bridge`: static CLI binary wiring L1 + L2.

### 2. TypeScript Browser Packages (`packages/*`)

- `@thegreataxios/webmcp-core`: wraps `@w3c/webmcp-polyfill` in secure browser contexts, provides a spec-aligned fallback for non-secure/test DOMs, adds `waitForToolsUntil` stability tracking, `ToolActivatedEvent`/`ToolCancelEvent`, origin policy, journeys, and the page WebSocket bridge client (with `cancel_tool` propagation).
- `@thegreataxios/webmcp-react`: StrictMode-safe React bindings (`WebMCPProvider`, `WebMCPTool`, `useWebMCP`, `useWaitForToolsUntil`, plus `experimental_*` sync/journey/confirm/bridge hooks).
- `@thegreataxios/webmcp-bridge`: TypeScript bridge library + CLI compatibility wrapper.
- `@thegreataxios/webmcp`: umbrella re-exports.

## Data Flow

```text
App / Adapter  ──► document.modelContext.registerTool(tool, { signal, exposedTo })
Page Client    ──► ws://127.0.0.1:17321/ws (Origin + constant-time token auth)
MCP Host       ──► stdio / POST /mcp ──► webmcp-bridge ──► execute_tool / cancel_tool
               ──► document.modelContext.executeTool(tool, args, { signal })
```

## Quality Bar

- `arch-lint check` passes with 0 violations (layer boundaries + 450-line file budget).
- `cargo clippy --workspace --all-targets -- -D warnings` with `unsafe_code = "forbid"` and `unused_must_use = "deny"`.
- Zero Zod peer dependency; JSON Schema objects validated directly.
- `experimental_*` prefix required for all non-spec extensions.
