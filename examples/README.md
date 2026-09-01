# webmcp examples

Standalone Vite + React + TypeScript demos for `@thegreataxios/webmcp-*`.

## Conventions

| Item | Convention |
|------|------------|
| Bundler | Vite |
| UI | React 19 + TypeScript |
| Theme | `@thegreataxios/webmcp-examples-theme` (`examples/_theme`) |
| Packages | workspace deps on `@thegreataxios/webmcp-react` + `@thegreataxios/webmcp-core` |
| Ports | uncommon ports (`43110+`) — avoid 3000 / 5173 / 8080 |
| Experimental JSX | alias `experimental_*` to PascalCase (`as Journey`, `as GuardedTool`, …) |
| Polyfill | installed by `WebMCPProvider` — do **not** tell users to import `installPolyfill` |

## Run any example

From the monorepo root:

```bash
bun install
bun run build
cd examples/<name>
bun run dev
```

Or from the example directory after a root install:

```bash
bun install
bun run dev
```

## Examples

| Example | Port | Branch / stack | Feature |
|---------|------|----------------|---------|
| [`shell`](./shell) | 43109 | foundation | Blank themed shell |
| [`tools`](./tools) | 43110 | tools | `WebMCPProvider` + `WebMCPTool` |

Later stack PRs add `sync`, `journeys`, `confirm`, and `bridge`.

## Local tool exercise (no bridge)

In the browser console on feature example pages using the polyfill:

```js
await navigator.modelContextTesting.listTools();
await navigator.modelContextTesting.executeTool(
  "tool_name",
  JSON.stringify({ /* args */ }),
);
```

Native `document.modelContext` implementations do not expose the polyfill-only
`navigator.modelContextTesting` API; use a compatible agent or browser tool
client instead.

Use the bridge example + `webmcp-bridge` when you want Cursor / Claude Desktop to call tools.
