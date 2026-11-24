# webmcp

**Spec-aligned toolkit and Rust MCP bridge for the [W3C WebMCP](https://github.com/webmachinelearning/webmcp) API (`document.modelContext`).**

Expose structured, typed client-side tools from any web app to AI agents — with a zero-dependency headless core (wrapping [`@w3c/webmcp-polyfill`](https://github.com/w3c-oss/webmcp-polyfill)), thin framework adapters, and a static Rust MCP bridge (`stdio` + Streamable HTTP).

---

## Architecture

```text
Browser Tab (TypeScript — headless core + thin adapters)
├── @thegreataxios/webmcp-core       document.modelContext (@w3c/webmcp-polyfill), Tool snapshots,
│                                    events, waitForToolsUntil, origin policy, page bridge client
├── @thegreataxios/webmcp-react      React provider, <WebMCPTool>, hooks, sync, journeys, HITL
└── @thegreataxios/webmcp            Umbrella re-exports
         │
         │  ws://127.0.0.1:17321/ws  (localhost-only, origin-checked, constant-time token auth)
         ▼
Off-Browser Bridge (Rust L1 / L2 / L3 workspace, enforced by arch-lint)
├── L1 (zero I/O):  webmcp-protocol, webmcp-policy
├── L2 (adapters):  webmcp-auth, webmcp-ws, webmcp-mcp (stdio + Streamable HTTP /mcp)
└── L3 (binary):    apps/webmcp-bridge  ──►  Cursor / Claude / any MCP client
```

---

## W3C Spec Conformance (Nov 2026 Draft)

| Spec Feature | Status | Notes |
|---|---|---|
| `document.modelContext.registerTool(tool, { signal, exposedTo })` | ✅ | Wraps `@w3c/webmcp-polyfill` in secure contexts; spec-aligned fallback in test DOMs |
| `document.modelContext.getTools({ fromOrigins })` → `Tool[]` | ✅ | Immutable `Tool` snapshots with `source`, `origin`, `inputSchema`, `outputSchema`, `annotations` |
| `document.modelContext.executeTool(tool, input, { signal })` | ✅ | Validates registration identity; propagates `AbortSignal` to `execute(input, { signal })` |
| `document.modelContext.waitForToolsUntil(promise)` | ✅ | Hydration / async tool stability tracking (`awaitToolsStable()`) |
| `toolchange`, `toolactivated`, `toolcancel` events | ✅ | Includes `ToolActivatedEvent` and `ToolCancelEvent` (`toolName`) |
| `ToolAnnotations` (`readOnlyHint`, `untrustedContentHint`, `consequentialHint`, `debugging`) | ✅ | Full dictionary supported across core, React, and Rust bridge |
| Cross-origin two-sided opt-in (`exposedTo` + `fromOrigins`) | ✅ | Enforced in both TypeScript core and Rust `webmcp-policy` |

---

## Packages & Crates

### npm packages

| Package | Description |
|---|---|
| [`@thegreataxios/webmcp-core`](./packages/core) | `document.modelContext` wrapper, validation, events, origin policy, journeys, page bridge client |
| [`@thegreataxios/webmcp-elements`](./packages/elements) | Framework-agnostic Web Components (`<webmcp-provider>`, `<webmcp-tool>`, `<webmcp-journey>`) |
| [`@thegreataxios/webmcp-react`](./packages/react) | React provider, `<WebMCPTool>`, `useWaitForToolsUntil`, state sync, journeys, HITL confirm |
| [`@thegreataxios/webmcp-svelte`](./packages/svelte) | Svelte 4/5 bindings (`createWebMCPProvider`, `useWebMCPTool`, reactive stores) |
| [`@thegreataxios/webmcp-vue`](./packages/vue) | Vue 3 Composition API & plugin (`createWebMCPPlugin`, `provideWebMCP`, `useWebMCPTool`) |
| [`@thegreataxios/webmcp-bridge`](./packages/bridge) | Localhost WebSocket ↔ MCP bridge (TypeScript library + CLI) |
| [`@thegreataxios/webmcp`](./packages/webmcp) | Umbrella re-exports (`/elements`, `/react`, `/svelte`, `/vue`, `/bridge`) |

### Rust workspace (`Cargo.toml`)

| Crate / App | Layer | Responsibility |
|---|---|---|
| `crates/arch-lint` | Tooling | Enforces layer boundaries, forbidden crates, and 450-line file budgets (`arch-rules.toml`) |
| `crates/webmcp-protocol` | L1 | Pure domain types, wire messages, validation, and `BridgeHub` port trait (zero I/O) |
| `crates/webmcp-policy` | L1 | Localhost bind invariants, origin allowlists, two-sided cross-origin visibility, journeys |
| `crates/webmcp-auth` | L2 | 256-bit CSPRNG token generator, constant-time token compare, env config loader |
| `crates/webmcp-ws` | L2 | Localhost Axum WebSocket relay + `PageSessionHub` |
| `crates/webmcp-mcp` | L2 | JSON-RPC 2.0 MCP server over `stdio` and Streamable HTTP (`POST /mcp`) |
| `apps/webmcp-bridge` | L3 | Static CLI binary (`webmcp-bridge`) |

---

## Quick Start

### 1. Browser (React)

```bash
bun add @thegreataxios/webmcp-react @thegreataxios/webmcp-core
```

```tsx
import { WebMCPProvider, WebMCPTool } from "@thegreataxios/webmcp-react";

export function App() {
  return (
    <WebMCPProvider name="shop" version="1.0.0">
      <WebMCPTool
        name="search_catalog"
        title="Search Catalog"
        description="Search products by keyword"
        inputSchema={{
          type: "object",
          properties: { query: { type: "string" } },
          required: ["query"],
        }}
        outputSchema={{
          type: "object",
          properties: { count: { type: "number" } },
        }}
        annotations={{ readOnlyHint: true }}
        handler={async ({ query }, options) => {
          const res = await fetch(`/api/search?q=${encodeURIComponent(String(query))}`, {
            signal: options?.signal,
          });
          return res.json();
        }}
      />
    </WebMCPProvider>
  );
}
```

### 2. Local MCP Bridge (Rust CLI)

```bash
# Generate a 256-bit shared token
export WEBMCP_BRIDGE_TOKEN=$(cargo run -q -p webmcp-bridge -- --generate-token)

# Start stdio MCP + localhost WebSocket relay (add --http-mcp for POST /mcp)
cargo run -p webmcp-bridge -- --http-mcp
```

---

## Development

```bash
# TypeScript workspace
bun install
bun run build
bun run typecheck
bun run test

# Rust workspace
bun run arch:check      # cargo run -p arch-lint -- check
bun run rust:test       # cargo test --workspace
bun run rust:clippy     # cargo clippy --workspace --all-targets -- -D warnings
bun run rust:build      # cargo build --release -p webmcp-bridge
```

See [PROJECT.md](./PROJECT.md), [CONTRIBUTING.md](./CONTRIBUTING.md), [SECURITY.md](./SECURITY.md), and [examples/README.md](./examples/README.md).

---

## `experimental_*` Policy

Non-spec features (journeys, state sync, HITL confirmations, bridge provider) use an `experimental_` prefix. Breaking changes are allowed there without bumping the major version of stable spec-aligned APIs.

## Project Status

This repository is independent open-source software and is not endorsed by the W3C Web Machine Learning Community Group. For normative specification work, see [`webmachinelearning/webmcp`](https://github.com/webmachinelearning/webmcp).

## License

MIT — see [LICENSE](./LICENSE).
