import { useState } from "react";
import {
  WebMCPProvider,
  experimental_useWebMCPSync,
  useWebMCP,
} from "@thegreataxios/webmcp-react";
import {
  MAX_QTY,
  SKUS,
  addToCart,
  removeFromCart,
  setQuantity,
  type Cart,
} from "./cart";

function money(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function SyncDemo() {
  const { available } = useWebMCP();
  const [flash, setFlash] = useState<string | null>(null);

  const cart = experimental_useWebMCPSync<Cart>({
    initial: { items: [] },
    tools: {
      add_to_cart: {
        title: "Add to cart",
        description: `Add 1–${MAX_QTY} units of a known product to the cart.`,
        inputSchema: {
          type: "object",
          properties: {
            sku: { type: "string", enum: Object.keys(SKUS), description: "Product SKU" },
            qty: {
              type: "integer",
              minimum: 1,
              maximum: MAX_QTY,
              default: 1,
              description: `Units to add (maximum ${MAX_QTY} total per SKU)`,
            },
          },
          required: ["sku"],
          additionalProperties: false,
        },
        reducer: addToCart,
      },
      remove_from_cart: {
        title: "Remove from cart",
        description: "Remove a product that is currently in the cart.",
        inputSchema: {
          type: "object",
          properties: {
            sku: { type: "string", enum: Object.keys(SKUS), description: "Product SKU" },
          },
          required: ["sku"],
          additionalProperties: false,
        },
        reducer: removeFromCart,
      },
      set_quantity: {
        title: "Set cart quantity",
        description: `Set a cart item's quantity from 0 (remove) through ${MAX_QTY}.`,
        inputSchema: {
          type: "object",
          properties: {
            sku: { type: "string", enum: Object.keys(SKUS), description: "Product SKU" },
            qty: { type: "integer", minimum: 0, maximum: MAX_QTY },
          },
          required: ["sku", "qty"],
          additionalProperties: false,
        },
        reducer: setQuantity,
      },
    },
    onMutation: ({ tool, next }) => {
      const count = next.items.reduce((n, i) => n + i.qty, 0);
      setFlash(`${tool} · ${count} item${count === 1 ? "" : "s"} in cart`);
    },
  });

  const total = cart.state.items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const count = cart.state.items.reduce((n, i) => n + i.qty, 0);

  return (
    <>
      {cart.Tools}
      <div className="wm-app">
        <div className="wm-page">
          <header className="wm-topbar wm-animate-in">
            <a className="wm-brand" href="/">
              web<span>mcp</span>
            </a>
            <div className="wm-kicker">
              <span
                className={`wm-chip${available ? " wm-live-pulse" : ""}`}
                data-tone={available ? "ok" : "warn"}
                role="status"
              >
                <span className="wm-dot" aria-hidden />
                {available ? "sync live" : "starting"}
              </span>
              <span className="wm-chip" data-tone="accent">
                {count} in cart
              </span>
            </div>
          </header>

          <main>
            <section className="wm-hero wm-animate-in-delay">
              <p className="wm-eyebrow">Sync</p>
              <h1>The cart moves when tools fire.</h1>
              <p className="wm-lede">
                <span className="wm-mono">experimental_useWebMCPSync</span> turns
                agent tool calls into React state. Add, remove, or set quantity —
                the UI refreshes without a page reload.
              </p>
              <div className="wm-cta-row">
                {flash ? (
                  <span
                    className="wm-chip wm-fade-in"
                    data-tone="ok"
                    key={flash}
                    role="status"
                    aria-live="polite"
                  >
                    {flash}
                  </span>
                ) : (
                  <span className="wm-muted">Waiting for a mutation…</span>
                )}
                <span className="wm-muted wm-mono">localhost:43111</span>
              </div>
            </section>

            <section className="wm-section wm-animate-in-late">
              <h2>Cart</h2>
              <p>Known SKUs: {Object.keys(SKUS).join(", ")}.</p>
              <div className="wm-panel">
                {cart.state.items.length === 0 ? (
                  <p className="wm-empty" style={{ margin: 0 }}>
                    Cart is empty. Call <span className="wm-mono">add_to_cart</span>{" "}
                    with a sku like <span className="wm-mono">atlas-mug</span>.
                  </p>
                ) : (
                  <>
                    <ul className="wm-list">
                      {cart.state.items.map((item) => (
                        <li key={item.sku} className="wm-fade-in">
                          <div>
                            <strong>{item.name}</strong>
                            <div className="wm-muted wm-mono" style={{ fontSize: "0.85rem" }}>
                              {item.sku} · {money(item.price)} each
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div>×{item.qty}</div>
                            <div className="wm-muted">{money(item.price * item.qty)}</div>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginTop: "1rem",
                        paddingTop: "0.85rem",
                        borderTop: "1px solid var(--wm-border)",
                        fontWeight: 600,
                      }}
                    >
                      <span>Total</span>
                      <span>{money(total)}</span>
                    </div>
                  </>
                )}
              </div>
            </section>

            <section className="wm-section">
              <h2>Try it locally</h2>
              <pre className="wm-result">{`await navigator.modelContextTesting.executeTool(
  "add_to_cart",
  JSON.stringify({ sku: "atlas-mug", qty: 2 }),
)
await navigator.modelContextTesting.executeTool(
  "add_to_cart",
  JSON.stringify({ sku: "harbor-tote" }),
)
await navigator.modelContextTesting.executeTool(
  "set_quantity",
  JSON.stringify({ sku: "atlas-mug", qty: 1 }),
)
await navigator.modelContextTesting.executeTool(
  "remove_from_cart",
  JSON.stringify({ sku: "harbor-tote" }),
)`}</pre>
            </section>
          </main>

          <footer className="wm-footer">webmcp examples · sync · MIT</footer>
        </div>
      </div>
    </>
  );
}

export function App() {
  return (
    <WebMCPProvider name="webmcp-sync" version="0.1.0">
      <SyncDemo />
    </WebMCPProvider>
  );
}
