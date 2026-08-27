# @thegreataxios/webmcp

Agent-native toolkit for the [W3C WebMCP](https://github.com/webmachinelearning/webmcp) API (`document.modelContext`).

**Providers define. Hooks consume.** Spec-aligned core; better agentic UX via `experimental_*` APIs.

## Packages

| Package | Description |
|---------|-------------|
| `@thegreataxios/webmcp-core` | Registry, polyfill, custom elements |
| `@thegreataxios/webmcp-react` | React provider, `WebMCPTool`, experimental sync/journeys |
| `@thegreataxios/webmcp-bridge` | Local stdio MCP ↔ WebSocket (no Chrome extension) |

Future: `@thegreataxios/webmcp-devtools`

## Quick start (planned P1)

```tsx
import {
  WebMCPProvider,
  WebMCPTool,
  experimental_useWebMCPSync,
  experimental_WebMCPJourney,
} from "@thegreataxios/webmcp-react";

function App() {
  const cart = experimental_useWebMCPSync({
    initial: { items: [] },
    tools: {
      add_to_cart: (cart, { sku }) => ({
        ...cart,
        items: [...cart.items, sku as string],
      }),
    },
  });

  return (
    <WebMCPProvider name="shop" version="0.0.0">
      {cart.Tools}
      <experimental_WebMCPJourney name="buying" tools={["add_to_cart"]}>
        <WebMCPTool
          name="search"
          description="Search products"
          inputSchema={{
            type: "object",
            properties: { q: { type: "string" } },
          }}
          handler={async ({ q }) => ({
            content: [{ type: "text", text: `Results for ${q}` }],
          })}
        />
      </experimental_WebMCPJourney>
      <pre>{JSON.stringify(cart.state)}</pre>
    </WebMCPProvider>
  );
}
```

## Cursor bridge

```json
{
  "mcpServers": {
    "webmcp-bridge": {
      "command": "webmcp-bridge"
    }
  }
}
```

Bridge binds `127.0.0.1:17321` with token auth. See [PLAN.md](./PLAN.md).

## Development

```bash
bun install
bun test
bun run build
```

## experimental_* policy

Non-spec features use `experimental_` prefix (journeys, state sync, confirm). See PLAN.md for W3C alignment track.

## License

MIT
