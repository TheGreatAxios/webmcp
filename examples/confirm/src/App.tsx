import { useEffect, useRef, useState } from "react";
import {
  WebMCPProvider,
  WebMCPTool,
  experimental_WebMCPConfirmProvider as ConfirmProvider,
  experimental_WebMCPGuardedTool as GuardedTool,
  experimental_useWebMCPConfirm,
  useWebMCP,
} from "@thegreataxios/webmcp-react";

type CartItem = { sku: string; name: string; qty: number };

const INITIAL: CartItem[] = [
  { sku: "atlas-mug", name: "Atlas Mug", qty: 2 },
  { sku: "harbor-tote", name: "Harbor Tote", qty: 1 },
];

function ConfirmDialog({ lineCount }: { lineCount: number }) {
  const { pending } = experimental_useWebMCPConfirm();
  const approveRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (pending) approveRef.current?.focus();
  }, [pending]);

  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") pending.reject("declined");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending]);

  if (!pending) return null;

  return (
    <div className="wm-dialog-backdrop" role="presentation">
      <div
        className="wm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
      >
        <h2 id="confirm-title">Clear the cart?</h2>
        <p id="confirm-desc">
          An agent wants to run <span className="wm-mono">{pending.tool}</span>
          {lineCount > 0 ? (
            <>
              {" "}
              and remove <strong>{lineCount}</strong> line
              {lineCount === 1 ? "" : "s"} from your cart.
            </>
          ) : (
            <> on an already empty cart.</>
          )}{" "}
          This cannot be undone from the page.
        </p>
        <div className="wm-dialog-actions">
          <button type="button" className="wm-btn wm-btn-ghost" onClick={() => pending.reject("declined")}>
            Keep cart
          </button>
          <button
            ref={approveRef}
            type="button"
            className="wm-btn wm-btn-danger"
            onClick={() => pending.approve()}
          >
            Clear cart
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDemo() {
  const [items, setItems] = useState<CartItem[]>(INITIAL);
  const [status, setStatus] = useState<string | null>(null);
  const { available } = useWebMCP();
  const count = items.reduce((n, i) => n + i.qty, 0);

  return (
    <>
      <WebMCPTool
        name="add_demo_item"
        description="Add a Field Notebook to the demo cart (no confirmation)."
        handler={async () => {
          setItems((prev) => {
            const existing = prev.find((i) => i.sku === "field-notebook");
            if (existing) {
              return prev.map((i) =>
                i.sku === "field-notebook" ? { ...i, qty: i.qty + 1 } : i,
              );
            }
            return [...prev, { sku: "field-notebook", name: "Field Notebook", qty: 1 }];
          });
          setStatus("Added Field Notebook (unguarded).");
          return { content: [{ type: "text", text: "Added field-notebook" }] };
        }}
      />
      <GuardedTool
        name="clear_cart"
        description="Remove every item from the cart. Requires human confirmation."
        requiresConfirm
        handler={async () => {
          setItems([]);
          setStatus("Cart cleared after confirmation.");
          return {
            content: [{ type: "text", text: "Cart cleared" }],
            structuredContent: { items: [] },
          };
        }}
      />
      <ConfirmDialog lineCount={items.length} />

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
              >
                <span className="wm-dot" aria-hidden />
                HITL ready
              </span>
              <span className="wm-chip" data-tone="accent">
                {count} items
              </span>
            </div>
          </header>

          <main>
            <section className="wm-hero wm-animate-in-delay">
              <p className="wm-eyebrow">Confirm</p>
              <h1>Destructive tools wait for you.</h1>
              <p className="wm-lede">
                <span className="wm-mono">GuardedTool</span> pauses{" "}
                <span className="wm-mono">clear_cart</span> until a human
                approves. Safe tools like <span className="wm-mono">add_demo_item</span>{" "}
                run immediately.
              </p>
              <div className="wm-cta-row">
                {status ? (
                  <span className="wm-chip wm-fade-in" data-tone="ok" key={status}>
                    {status}
                  </span>
                ) : (
                  <span className="wm-muted">Call clear_cart to open the dialog.</span>
                )}
                <span className="wm-muted wm-mono">localhost:43113</span>
              </div>
            </section>

            <section className="wm-section wm-animate-in-late">
              <h2>Cart</h2>
              <p>Approve or decline when the agent requests a clear. Esc declines.</p>
              <div className="wm-panel">
                {items.length === 0 ? (
                  <p className="wm-empty" style={{ margin: 0 }}>
                    Cart is empty. Call <span className="wm-mono">add_demo_item</span> to
                    restock, then try <span className="wm-mono">clear_cart</span> again.
                  </p>
                ) : (
                  <ul className="wm-list">
                    {items.map((item) => (
                      <li key={item.sku} className="wm-fade-in">
                        <div>
                          <strong>{item.name}</strong>
                          <div className="wm-muted wm-mono" style={{ fontSize: "0.85rem" }}>
                            {item.sku}
                          </div>
                        </div>
                        <span>×{item.qty}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section className="wm-section">
              <h2>Try it locally</h2>
              <pre className="wm-result">{`await navigator.modelContextTesting.executeTool(
  "clear_cart",
  JSON.stringify({}),
)
// Approve or decline in the dialog, then optionally:
await navigator.modelContextTesting.executeTool(
  "add_demo_item",
  JSON.stringify({}),
)`}</pre>
            </section>
          </main>

          <footer className="wm-footer">webmcp examples · confirm · MIT</footer>
        </div>
      </div>
    </>
  );
}

export function App() {
  return (
    <WebMCPProvider name="webmcp-confirm" version="0.1.0">
      <ConfirmProvider>
        <ConfirmDemo />
      </ConfirmProvider>
    </WebMCPProvider>
  );
}
