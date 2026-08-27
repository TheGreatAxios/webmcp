import { useCallback, useEffect, useState } from "react";
import {
  WebMCPProvider,
  WebMCPTool,
  useWebMCP,
} from "@thegreataxios/webmcp-react";
import { getProduct, searchProducts, type Product } from "./catalog";

type ToolCallRecord = {
  tool: string;
  args: Record<string, unknown>;
  at: number;
  ok: boolean;
  summary: string;
  payload: unknown;
};

function StatusBar() {
  const { available, native, appName } = useWebMCP();
  return (
    <div className="wm-kicker">
      <span className={`wm-chip${available ? " wm-live-pulse" : ""}`} data-tone={available ? "ok" : "warn"}>
        <span className="wm-dot" aria-hidden />
        {available ? "modelContext ready" : "waiting for polyfill"}
      </span>
      <span className="wm-chip" data-tone="accent">
        {native ? "native" : "polyfill"}
      </span>
      <span className="wm-chip wm-mono">{appName}</span>
    </div>
  );
}

function ResultPanel({ last }: { last: ToolCallRecord | null }) {
  if (!last) {
    return (
      <div className="wm-panel wm-fade-in">
        <p className="wm-empty" style={{ margin: 0 }}>
          No tool calls yet. Ask an agent to search, or run the console snippet
          below.
        </p>
      </div>
    );
  }

  return (
    <div className="wm-panel wm-fade-in" key={last.at}>
      <div className="wm-kicker" style={{ marginBottom: "0.85rem" }}>
        <span className="wm-chip" data-tone={last.ok ? "ok" : "danger"}>
          {last.ok ? "ok" : "error"}
        </span>
        <span className="wm-chip wm-mono">{last.tool}</span>
        <span className="wm-muted" style={{ fontSize: "0.85rem" }}>
          {new Date(last.at).toLocaleTimeString()}
        </span>
      </div>
      <p style={{ margin: "0 0 0.85rem", color: "var(--wm-ink-soft)" }}>{last.summary}</p>
      <pre className="wm-result">{JSON.stringify(last.payload, null, 2)}</pre>
    </div>
  );
}

function ToolsDemo() {
  const [last, setLast] = useState<ToolCallRecord | null>(null);
  const [tools, setTools] = useState<string[]>([]);
  const { available } = useWebMCP();

  const record = useCallback((entry: Omit<ToolCallRecord, "at">) => {
    setLast({ ...entry, at: Date.now() });
  }, []);

  useEffect(() => {
    if (!available || !navigator.modelContextTesting) return;
    const refresh = () => {
      const listed = navigator.modelContextTesting!.listTools().map((t) => t.name);
      setTools(listed);
    };
    refresh();
    navigator.modelContextTesting.registerToolsChangedCallback(refresh);
  }, [available]);

  return (
    <>
      <WebMCPTool
        name="search"
        title="Search products"
        description="Search the sample catalog by name, category, or keyword."
        inputSchema={{
          type: "object",
          properties: {
            q: { type: "string", description: "Search query" },
          },
          required: ["q"],
        }}
        annotations={{ readOnlyHint: true }}
        handler={async ({ q }) => {
          const query = String(q ?? "");
          const results = searchProducts(query);
          const payload = {
            query,
            count: results.length,
            products: results.map((p: Product) => ({
              id: p.id,
              name: p.name,
              price: p.price,
              category: p.category,
            })),
          };
          record({
            tool: "search",
            args: { q: query },
            ok: true,
            summary:
              results.length === 0
                ? `No products matched “${query}”.`
                : `Found ${results.length} product${results.length === 1 ? "" : "s"} for “${query}”.`,
            payload,
          });
          return {
            content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
            structuredContent: payload,
          };
        }}
      />
      <WebMCPTool
        name="get_product"
        title="Get product"
        description="Fetch a single product by id (e.g. atlas-mug) or exact name."
        inputSchema={{
          type: "object",
          properties: {
            id: { type: "string", description: "Product id or name" },
          },
          required: ["id"],
        }}
        annotations={{ readOnlyHint: true }}
        handler={async ({ id }) => {
          const key = String(id ?? "");
          const product = getProduct(key);
          if (!product) {
            const payload = { id: key, found: false };
            record({
              tool: "get_product",
              args: { id: key },
              ok: false,
              summary: `No product for “${key}”. Try atlas-mug or harbor-tote.`,
              payload,
            });
            return {
              content: [{ type: "text", text: `Product not found: ${key}` }],
              structuredContent: payload,
              isError: true,
            };
          }
          record({
            tool: "get_product",
            args: { id: key },
            ok: true,
            summary: `${product.name} — $${product.price}`,
            payload: product,
          });
          return {
            content: [{ type: "text", text: JSON.stringify(product, null, 2) }],
            structuredContent: product as unknown as Record<string, unknown>,
          };
        }}
      />

      <div className="wm-app">
        <div className="wm-page">
          <header className="wm-topbar wm-animate-in">
            <a className="wm-brand" href="/">
              web<span>mcp</span>
            </a>
            <StatusBar />
          </header>

          <main>
            <section className="wm-hero wm-animate-in-delay">
              <p className="wm-eyebrow">Tools</p>
              <h1>Let agents search the shelf.</h1>
              <p className="wm-lede">
                Two read-only tools — <span className="wm-mono">search</span> and{" "}
                <span className="wm-mono">get_product</span> — register through{" "}
                <span className="wm-mono">WebMCPProvider</span>. Results land here
                the moment a call completes.
              </p>
              <div className="wm-cta-row">
                <span className="wm-chip" data-tone="accent">
                  {tools.length} tool{tools.length === 1 ? "" : "s"} exposed
                </span>
                <span className="wm-muted wm-mono">localhost:43110</span>
              </div>
            </section>

            <section className="wm-section wm-animate-in-late">
              <h2>Last result</h2>
              <p>Agent or console calls update this panel in place.</p>
              <ResultPanel last={last} />
            </section>

            <section className="wm-section">
              <h2>Try it locally</h2>
              <p>
                Polyfill is already installed by the provider. In DevTools:
              </p>
              <pre className="wm-result">{`await navigator.modelContextTesting.listTools()
await navigator.modelContextTesting.executeTool(
  "search",
  JSON.stringify({ q: "mug" }),
)
await navigator.modelContextTesting.executeTool(
  "get_product",
  JSON.stringify({ id: "harbor-tote" }),
)`}</pre>
            </section>
          </main>

          <footer className="wm-footer">webmcp examples · tools · MIT</footer>
        </div>
      </div>
    </>
  );
}

export function App() {
  return (
    <WebMCPProvider name="webmcp-tools" version="0.1.0">
      <ToolsDemo />
    </WebMCPProvider>
  );
}
