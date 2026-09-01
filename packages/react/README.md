# @thegreataxios/webmcp-react

React bindings for WebMCP. **Providers define tools; hooks consume context.**

## Install

```bash
bun add @thegreataxios/webmcp-react @thegreataxios/webmcp-core
```

Peer: `react` ≥ 18.

## Quick start

```tsx
import {
  WebMCPProvider,
  WebMCPTool,
  experimental_useWebMCPSync,
} from "@thegreataxios/webmcp-react";

function App() {
  const cart = experimental_useWebMCPSync({
    initial: { items: [] as string[] },
    tools: {
      add_to_cart: {
        description: "Add a SKU to the cart",
        inputSchema: {
          type: "object",
          properties: { sku: { type: "string" } },
          required: ["sku"],
        },
        reducer: (cart, { sku }) => ({
          ...cart,
          items: [...cart.items, String(sku)],
        }),
      },
    },
  });

  return (
    <WebMCPProvider name="shop" version="1.0.0">
      {cart.Tools}
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
      <pre>{JSON.stringify(cart.state)}</pre>
    </WebMCPProvider>
  );
}
```

## Stable exports

| Export | Role |
|--------|------|
| `WebMCPProvider` | Installs polyfill, journey registry |
| `WebMCPTool` | Declares one tool (StrictMode-safe) |
| `useWebMCP()` | `{ available, native, appName, journeyRegistry }` |

## Experimental exports

React requires component names to start with an uppercase letter in JSX. Alias `experimental_*` exports:

```tsx
import {
  experimental_WebMCPJourney as Journey,
  experimental_WebMCPConfirmProvider as ConfirmProvider,
} from "@thegreataxios/webmcp-react";
```

| Export | Role |
|--------|------|
| `experimental_useWebMCPSync` | Agent calls → React state updates |
| `experimental_WebMCPJourney` | Phase-scoped tool visibility |
| `experimental_useWebMCPJourney` | Read active journeys / `isToolExposed` |
| `experimental_WebMCPConfirmProvider` | HITL confirmation queue |
| `experimental_WebMCPGuardedTool` | Tool that requires user approval |
| `experimental_WebMCPBridgeProvider` | Page ↔ `webmcp-bridge` WebSocket |
| `experimental_useWebMCPBridgeStatus` | Bridge connection status |

Experimental APIs may change without a major stable semver bump.

## Journeys

React requires component names to start with an uppercase letter in JSX. Alias `experimental_*` exports:

```tsx
import { experimental_WebMCPJourney as Journey } from "@thegreataxios/webmcp-react";

<Journey name="buying" tools={["search", "add_to_cart"]}>
  <WebMCPTool name="search" ... />
  <WebMCPTool name="add_to_cart" ... />
</Journey>
```

Checkout tools stay unregistered for agents until a checkout journey is active.

## Cursor / Claude (no extension)

```tsx
<experimental_WebMCPBridgeProvider token={bridgeToken}>
  <WebMCPProvider name="shop" version="1.0.0">
    ...
  </WebMCPProvider>
</experimental_WebMCPBridgeProvider>
```

Run `webmcp-bridge` and pass the printed token.

## License

MIT
