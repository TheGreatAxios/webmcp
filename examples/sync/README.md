# Sync example

Live cart UI driven by `experimental_useWebMCPSync`.

## Run

```bash
bun install
bun run build   # from monorepo root
cd examples/sync
bun run dev
```

Opens on **http://localhost:43111**.

## What it demos

- Agent tool calls (`add_to_cart`, `remove_from_cart`, `set_quantity`) update React state
- Cart total and flash status update immediately
- Empty cart copy when nothing is selected

## Exercise tools

```js
await navigator.modelContextTesting.executeTool(
  "add_to_cart",
  JSON.stringify({ sku: "atlas-mug", qty: 2 }),
);
```

Known SKUs: `atlas-mug`, `harbor-tote`, `lumen-lamp`, `field-notebook`.
Quantities must be whole numbers from 0–100 (`add_to_cart` requires at least
1). Unknown SKUs, missing cart items, and invalid quantities return tool errors.
The console helper is polyfill-only; native WebMCP browsers should exercise
tools through a compatible agent or browser tool client.
