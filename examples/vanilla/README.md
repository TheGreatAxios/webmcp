# Vanilla example

No-React demo: custom elements, direct `document.modelContext` calls, and the
core registry — everything outside `@thegreataxios/webmcp-react`.

## Run

```bash
bun install
bun run build   # from monorepo root
cd examples/vanilla
bun run dev
```

Opens on **http://localhost:43115**.

## What it demos

- `registerWebMCPElements` + `<webmcp-provider>` in `index.html`
- `installPolyfill` with the journey registry set first (journey switches emit `toolchange`)
- Direct `registerTool` with an `AbortSignal`, no provider
- `experimental_createJourneyRegistry` + focus toggle gating `greet`
- `validateToolDescriptor` rejecting a bad descriptor
- Standalone `createToolRegistry` (register → list → unregister)
- `createPageBridgeClient` without the React wrapper

## Exercise tools

```js
await navigator.modelContextTesting.listTools();
await navigator.modelContextTesting.executeTool("greet", JSON.stringify({ name: "Ada" }));
```

Toggle **Focus journey** on and confirm `listTools()` only returns `save_note`.
`navigator.modelContextTesting` is a polyfill-only inspection API; in a native
browser use a compatible agent or browser tool client.
