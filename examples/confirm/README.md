# Confirm example

Guarded `clear_cart` with a polished human-in-the-loop confirmation dialog.

## Run

```bash
bun install
bun run build   # from monorepo root
cd examples/confirm
bun run dev
```

Opens on **http://localhost:43113**.

## What it demos

- `experimental_WebMCPConfirmProvider` + `experimental_WebMCPGuardedTool`
- Destructive `clear_cart` requires approve / decline (Esc declines)
- Overlapping guarded calls queue for one-at-a-time confirmation
- Unguarded `add_demo_item` for restocking after a clear

## Exercise tools

```js
await navigator.modelContextTesting.executeTool(
  "clear_cart",
  JSON.stringify({}),
);
```

Approve or decline in the dialog, then watch the cart update.
The console helper is polyfill-only; native WebMCP browsers should call the
guarded tool through a compatible agent or browser tool client.
