# Journeys example

Browse vs checkout journey toggle with phase-scoped tool visibility.

## Run

```bash
bun install
bun run build   # from monorepo root
cd examples/journeys
bun run dev
```

Opens on **http://localhost:43112**.

## What it demos

- `experimental_WebMCPJourney` (aliased as `Journey` for JSX)
- Browse tools: `search`, `add_to_cart`
- Checkout tools: `get_cart`, `place_order`
- UI toggle changes which tools `listTools()` returns

## Exercise tools

1. Leave **Browse** selected and call `search`.
2. Switch to **Checkout** and call `place_order`.
3. Confirm `listTools()` only shows the active journey’s tools.

```js
await navigator.modelContextTesting.listTools();
```
