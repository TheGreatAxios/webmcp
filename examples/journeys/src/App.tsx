import { useEffect, useState } from "react";
import {
  WebMCPProvider,
  WebMCPTool,
  experimental_WebMCPJourney as Journey,
  experimental_useWebMCPJourney,
  useWebMCP,
} from "@thegreataxios/webmcp-react";

type Phase = "browse" | "checkout";

const BROWSE_TOOLS = ["search", "add_to_cart"] as const;
const CHECKOUT_TOOLS = ["get_cart", "place_order"] as const;

function JourneysDemo() {
  const [phase, setPhase] = useState<Phase>("browse");
  const [exposed, setExposed] = useState<string[] | null>(null);
  const [lastNote, setLastNote] = useState<string | null>(null);
  const { available, native } = useWebMCP();
  const { activeJourneys, isToolExposed } = experimental_useWebMCPJourney();

  useEffect(() => {
    if (!available || !navigator.modelContextTesting) {
      setExposed(null);
      return;
    }
    const refresh = () => {
      setExposed(navigator.modelContextTesting!.listTools().map((t) => t.name));
    };
    refresh();
    navigator.modelContextTesting.registerToolsChangedCallback(refresh);
  }, [available]);

  return (
    <>
      <Journey
        name="browse"
        description="Discover products and add them to the cart"
        tools={BROWSE_TOOLS}
        when={phase === "browse"}
      >
        <WebMCPTool
          name="search"
          description="Search products while browsing"
          inputSchema={{
            type: "object",
            properties: { q: { type: "string" } },
            required: ["q"],
          }}
          handler={async ({ q }) => {
            const query = String(q ?? "");
            setLastNote(`search(“${query}”) during browse`);
            return {
              content: [{ type: "text", text: `Results for ${query}` }],
            };
          }}
        />
        <WebMCPTool
          name="add_to_cart"
          description="Add a SKU to the cart while browsing"
          inputSchema={{
            type: "object",
            properties: { sku: { type: "string" } },
            required: ["sku"],
          }}
          handler={async ({ sku }) => {
            setLastNote(`add_to_cart(${sku}) during browse`);
            return {
              content: [{ type: "text", text: `Added ${sku}` }],
            };
          }}
        />
      </Journey>

      <Journey
        name="checkout"
        description="Review cart and place an order"
        tools={CHECKOUT_TOOLS}
        when={phase === "checkout"}
      >
        <WebMCPTool
          name="get_cart"
          description="Read the current cart during checkout"
          handler={async () => {
            setLastNote("get_cart during checkout");
            return {
              content: [{ type: "text", text: JSON.stringify({ items: ["atlas-mug"] }) }],
            };
          }}
        />
        <WebMCPTool
          name="place_order"
          description="Place the order during checkout"
          handler={async () => {
            setLastNote("place_order during checkout");
            return {
              content: [{ type: "text", text: "Order placed" }],
            };
          }}
        />
      </Journey>

      <div className="wm-app">
        <div className="wm-page">
          <header className="wm-topbar wm-animate-in">
            <a className="wm-brand" href="/">
              web<span>mcp</span>
            </a>
            <div className="wm-kicker">
              <span className="wm-chip" data-tone="accent">
                journey · {activeJourneys[0] ?? "none"}
              </span>
              <span className="wm-chip wm-mono">
                {exposed
                  ? `${exposed.length} tools`
                  : native
                    ? "inspection unavailable"
                    : "inspecting tools"}
              </span>
            </div>
          </header>

          <main>
            <section className="wm-hero wm-animate-in-delay">
              <p className="wm-eyebrow">Journeys</p>
              <h1>Browse and checkout, not both.</h1>
              <p className="wm-lede">
                Toggle the active journey. Tool visibility follows the phase —
                checkout tools stay hidden while browsing, and browse tools step
                aside at checkout.
              </p>
              <div className="wm-cta-row">
                <button
                  type="button"
                  className={`wm-btn ${phase === "browse" ? "wm-btn-primary" : "wm-btn-ghost"}`}
                  onClick={() => setPhase("browse")}
                  aria-pressed={phase === "browse"}
                >
                  Browse
                </button>
                <button
                  type="button"
                  className={`wm-btn ${phase === "checkout" ? "wm-btn-primary" : "wm-btn-ghost"}`}
                  onClick={() => setPhase("checkout")}
                  aria-pressed={phase === "checkout"}
                >
                  Checkout
                </button>
                <span className="wm-muted wm-mono">localhost:43112</span>
              </div>
            </section>

            <section className="wm-section wm-animate-in-late">
              <h2>Exposed right now</h2>
              <p>
                {exposed ? (
                  <>
                    Listed via <span className="wm-mono">modelContextTesting.listTools()</span>.
                  </>
                ) : (
                  <>
                    Native tool inspection is unavailable; these states reflect the active journey
                    registry.
                  </>
                )}
              </p>
              <div className="wm-panel wm-fade-in" key={phase}>
                <ul className="wm-list">
                  {[...BROWSE_TOOLS, ...CHECKOUT_TOOLS].map((name) => {
                    const on = exposed ? exposed.includes(name) : isToolExposed(name);
                    return (
                      <li key={name}>
                        <span className="wm-mono">{name}</span>
                        <span className="wm-chip" data-tone={on ? "ok" : "warn"}>
                          {on ? "exposed" : "hidden"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
              {lastNote ? (
                <p
                  className="wm-fade-in"
                  style={{ marginTop: "1rem" }}
                  role="status"
                  aria-live="polite"
                >
                  Last call: <strong>{lastNote}</strong>
                </p>
              ) : (
                <p className="wm-empty" style={{ marginTop: "1rem" }}>
                  No tool calls yet in this session.
                </p>
              )}
            </section>

            <section className="wm-section">
              <h2>{exposed ? "Try it locally" : "Native browser mode"}</h2>
              {exposed ? (
                <pre className="wm-result">{`// While Browse is active:
await navigator.modelContextTesting.listTools()
await navigator.modelContextTesting.executeTool(
  "search",
  JSON.stringify({ q: "mug" }),
)

// Switch to Checkout in the UI, then:
await navigator.modelContextTesting.listTools()
await navigator.modelContextTesting.executeTool(
  "place_order",
  JSON.stringify({}),
)`}</pre>
              ) : (
                <p>
                  Use a compatible agent or browser tool client to inspect and call the active
                  journey’s tools.
                </p>
              )}
            </section>
          </main>

          <footer className="wm-footer">webmcp examples · journeys · MIT</footer>
        </div>
      </div>
    </>
  );
}

export function App() {
  return (
    <WebMCPProvider name="webmcp-journeys" version="0.1.0">
      <JourneysDemo />
    </WebMCPProvider>
  );
}
