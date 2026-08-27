# webmcp — implementation plan

Community implementation of the [W3C WebMCP](https://github.com/webmachinelearning/webmcp) API. **Not** an official W3C or spec-editor product. Published as `@thegreataxios/webmcp*`.

## Deliverables

| Package | Stable | Experimental |
|---------|--------|--------------|
| `@thegreataxios/webmcp` | umbrella re-exports | — |
| `@thegreataxios/webmcp-core` | polyfill, registry, validation, custom elements, `createPageBridgeClient` | journeys, journey-filtered tool exposure |
| `@thegreataxios/webmcp-react` | `WebMCPProvider`, `WebMCPTool`, `useWebMCP` | `experimental_useWebMCPSync`, `experimental_WebMCPJourney`, `experimental_useWebMCPConfirm`, bridge provider |
| `@thegreataxios/webmcp-bridge` | `webmcp-bridge` CLI, localhost WS + stdio MCP | — |

## Data flow

```
React/WebMCPTool → document.modelContext.registerTool
Page bridge client → WS (token) → Bridge session
Cursor MCP → stdio → Bridge → WS call_tool → navigator.modelContextTesting.executeTool
```

## Test matrix

| Area | Tests |
|------|-------|
| validation | name pattern, duplicate, empty description, aborted signal |
| registry | register/unregister, change listeners, signal abort |
| polyfill | install/cleanup refcount, toolchange, testing shim |
| journey | active filter, multi-journey, tool exposure |
| bridge | origin check, token auth, MCP list/call proxy |
| react | provider, tool lifecycle, sync state, journey when, confirm gate |

## Quality bar

- No Zod peer dependency; JSON Schema on descriptors
- StrictMode-safe tool ownership in React
- `experimental_*` only for non-spec features
- No dead code, no duplicate registration paths (React registers via modelContext, not duplicate custom element path)
