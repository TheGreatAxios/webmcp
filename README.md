# @thegreataxios/webmcp

Agent-native toolkit for the [W3C WebMCP](https://github.com/webmachinelearning/webmcp) API.

**Providers define. Hooks consume.** Spec-aligned core; better agent UX via `experimental_*` APIs.

## Packages

| Package | Description |
|---------|-------------|
| [`@thegreataxios/webmcp-core`](./packages/core) | Polyfill, registry, custom elements, page bridge client |
| [`@thegreataxios/webmcp-react`](./packages/react) | React provider, tools, sync, journeys, confirm, bridge |
| [`@thegreataxios/webmcp-bridge`](./packages/bridge) | stdio MCP ↔ localhost WebSocket |

## Development

```bash
bun install
bun test
bun run build
bun run typecheck
```

## Architecture

See [PROJECT.md](./PROJECT.md) and [PLAN.md](./PLAN.md).

## experimental_* policy

Non-spec features use an `experimental_` prefix (journeys, state sync, HITL, bridge). Breaking changes allowed there without major stable semver bumps.

## License

MIT
