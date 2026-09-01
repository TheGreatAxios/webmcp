# webmcp

**A community implementation of the [W3C WebMCP](https://github.com/webmachinelearning/webmcp) API** — browser tools for AI agents via `document.modelContext`.

Published as `@thegreataxios/webmcp*` on npm. **Providers define. Hooks consume.** Spec-aligned core plus better agent UX via `experimental_*` APIs.

## Packages

| npm package | Description |
|-------------|-------------|
| [`@thegreataxios/webmcp`](./packages/webmcp) | Umbrella re-exports (`/react`, `/bridge` subpaths) |
| [`@thegreataxios/webmcp-core`](./packages/core) | Polyfill, registry, custom elements, page bridge client |
| [`@thegreataxios/webmcp-react`](./packages/react) | React provider, tools, sync, journeys, confirm, bridge |
| [`@thegreataxios/webmcp-bridge`](./packages/bridge) | stdio MCP ↔ localhost WebSocket (`webmcp-bridge` CLI) |

```bash
# Typical installs (pick what you need)
bun add @thegreataxios/webmcp-core
bun add @thegreataxios/webmcp-react @thegreataxios/webmcp-core
bun add -g @thegreataxios/webmcp-bridge

# Or umbrella imports
bun add @thegreataxios/webmcp
```

```ts
import { WebMCPProvider } from "@thegreataxios/webmcp/react";
import { createMcpBridge } from "@thegreataxios/webmcp/bridge";
```

## Examples

Standalone Vite + React demos live in [`examples/`](./examples). They share a uniform theme (`examples/_theme`) and depend on the workspace packages.

| Example | Port | Demo |
|---------|------|------|
| [`examples/shell`](./examples/shell) | 43109 | Themed foundation shell |
| [`examples/tools`](./examples/tools) | 43110 | Provider + tools |
| [`examples/sync`](./examples/sync) | 43111 | Live state sync |
| [`examples/journeys`](./examples/journeys) | 43112 | Journey-scoped tools |

More demos (`confirm`, `bridge`) land on stacked follow-up branches.

```bash
bun install
bun run build
cd examples/shell && bun run dev
```

See [examples/README.md](./examples/README.md) for conventions and how to exercise tools locally.

## Development

```bash
bun install
bun run build
bun run test
bun run typecheck
```

## Architecture

See [PROJECT.md](./PROJECT.md).

## `experimental_*` policy

Non-spec features use an `experimental_` prefix (journeys, state sync, HITL, bridge). Breaking changes are allowed there without major stable semver bumps on the core API.

## Project status

This repository and the `@thegreataxios/webmcp*` packages are independent open-source software. They are not official W3C specifications, are not maintained by the [Web Machine Learning Community Group](https://www.w3.org/community/webmachinelearning/), and are not endorsed by the WebMCP spec editors.

For normative spec work and discussion, see the official resources:

| Resource | URL |
|----------|-----|
| **WebMCP specification (GitHub)** | [github.com/webmachinelearning/webmcp](https://github.com/webmachinelearning/webmcp) |
| **Web Machine Learning Community Group** | [w3.org/community/webmachinelearning](https://www.w3.org/community/webmachinelearning/) |
| **Web Platform Design Principles** (context) | [w3.org/TR/design-principles](https://www.w3.org/TR/design-principles/) |

> [!NOTE]
> [webmcp.dev](https://webmcp.dev) is a separate third-party project (widget + MCP client integration). It is not the W3C spec and is unrelated to this monorepo.

## License

MIT — see [LICENSE](./LICENSE).
