# @thegreataxios/webmcp-react

React 18+ bindings for the [W3C WebMCP](https://github.com/webmachinelearning/webmcp) API. **Providers define tools; hooks consume context.**

## Install

```bash
bun add @thegreataxios/webmcp-react @thegreataxios/webmcp-core
```

## Quick Start

```tsx
import { WebMCPProvider, WebMCPTool } from "@thegreataxios/webmcp-react";

export function App() {
  return (
    <WebMCPProvider name="shop" version="1.0.0">
      <WebMCPTool
        name="search"
        title="Search Products"
        description="Search the product catalog"
        inputSchema={{
          type: "object",
          properties: { q: { type: "string" } },
          required: ["q"],
        }}
        outputSchema={{
          type: "object",
          properties: { results: { type: "array" } },
        }}
        annotations={{ readOnlyHint: true }}
        handler={async ({ q }, options) => {
          const res = await fetch(`/api/search?q=${encodeURIComponent(String(q))}`, {
            signal: options?.signal,
          });
          return res.json();
        }}
      />
    </WebMCPProvider>
  );
}
```

## Stable Exports

| Export | Role |
|---|---|
| `WebMCPProvider` | Installs polyfill & manages journey registry lifecycle |
| `WebMCPTool` | Registers a single tool (StrictMode-safe, supports `outputSchema`, `annotations`, `exposedTo`, and `options.signal`) |
| `useWebMCP()` | Returns `{ available, native, appName, appVersion, journeyRegistry }` |
| `useWaitForToolsUntil(promise)` | Signals async tool stability to `document.modelContext.waitForToolsUntil` |

## Experimental Exports

React JSX requires uppercase component identifiers, so alias `experimental_*` components when importing:

```tsx
import {
  experimental_WebMCPBridgeProvider as BridgeProvider,
  experimental_WebMCPConfirmProvider as ConfirmProvider,
  experimental_WebMCPGuardedTool as GuardedTool,
  experimental_WebMCPJourney as Journey,
  experimental_useWebMCPSync,
} from "@thegreataxios/webmcp-react";
```

| Export | Role |
|---|---|
| `experimental_useWebMCPSync` | Agent tool calls → React state reducer updates |
| `experimental_WebMCPJourney` / `experimental_useWebMCPJourney` | Phase-scoped tool visibility |
| `experimental_WebMCPConfirmProvider` / `experimental_WebMCPGuardedTool` / `experimental_useWebMCPConfirm` | Human-in-the-loop confirmation gate |
| `experimental_WebMCPBridgeProvider` / `experimental_useWebMCPBridgeStatus` | Connect page to `webmcp-bridge` WebSocket |

## License

MIT
