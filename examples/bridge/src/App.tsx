import { useMemo, useState, type FormEvent } from "react";
import {
  WebMCPProvider,
  WebMCPTool,
  experimental_WebMCPBridgeProvider as BridgeProvider,
  experimental_useWebMCPBridgeStatus,
  useWebMCP,
} from "@thegreataxios/webmcp-react";

const TOKEN_KEY = "webmcp-bridge-token";
const DEFAULT_URL = "ws://127.0.0.1:17321/ws";

function readInitialToken(): string {
  if (typeof window === "undefined") return "";
  const url = new URL(window.location.href);
  const fromQuery = url.searchParams.get("token")?.trim();
  if (url.searchParams.has("token")) {
    url.searchParams.delete("token");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }
  if (fromQuery) {
    localStorage.setItem(TOKEN_KEY, fromQuery);
    return fromQuery;
  }
  return localStorage.getItem(TOKEN_KEY) ?? "";
}

function statusTone(status: string): "ok" | "warn" | "danger" | "accent" {
  if (status === "connected") return "ok";
  if (status === "connecting") return "warn";
  if (status === "error") return "danger";
  return "accent";
}

function BridgeStatus() {
  const status = experimental_useWebMCPBridgeStatus();
  const { available, native } = useWebMCP();
  return (
    <div className="wm-kicker">
      <span
        className={`wm-chip${status === "connected" ? " wm-live-pulse" : ""}`}
        data-tone={statusTone(status)}
        role="status"
      >
        <span className="wm-dot" aria-hidden />
        bridge · {status}
      </span>
      <span className="wm-chip" data-tone={available && !native ? "ok" : "warn"}>
        {native ? "native inspection unavailable" : `modelContext ${available ? "on" : "off"}`}
      </span>
    </div>
  );
}

function BridgeInner({ onClearToken }: { onClearToken: () => void }) {
  const status = experimental_useWebMCPBridgeStatus();
  const [last, setLast] = useState<string | null>(null);
  const { native } = useWebMCP();

  return (
    <>
      <WebMCPTool
        name="ping"
        description="Simple health check tool exposed through the bridge."
        handler={async () => {
          const msg = `pong @ ${new Date().toLocaleTimeString()}`;
          setLast(msg);
          return { content: [{ type: "text", text: msg }] };
        }}
      />
      <WebMCPTool
        name="echo"
        description="Echo a message back through the bridge."
        inputSchema={{
          type: "object",
          properties: { message: { type: "string" } },
          required: ["message"],
        }}
        handler={async ({ message }) => {
          const text = String(message ?? "");
          setLast(`echo: ${text}`);
          return { content: [{ type: "text", text }] };
        }}
      />

      <div className="wm-app">
        <div className="wm-page">
          <header className="wm-topbar wm-animate-in">
            <a className="wm-brand" href="/">
              web<span>mcp</span>
            </a>
            <BridgeStatus />
          </header>

          <main>
            <section className="wm-hero wm-animate-in-delay">
              <p className="wm-eyebrow">Bridge</p>
              <h1>Cursor talks to this tab.</h1>
              <p className="wm-lede">
                Give Cursor and this page the same bridge token, and Cursor’s
                MCP client can call page tools over a localhost WebSocket — no
                Chrome extension.
              </p>
              <div className="wm-cta-row">
                <span className="wm-chip" data-tone={statusTone(status)}>
                  {status}
                </span>
                <button type="button" className="wm-btn wm-btn-ghost" onClick={onClearToken}>
                  Change token
                </button>
                <span className="wm-muted wm-mono">localhost:43114</span>
              </div>
            </section>

            <section className="wm-section wm-animate-in-late">
              <h2>Cursor setup</h2>
              <p>
                Generate one token, configure Cursor to launch the bridge with
                it, then paste the same token into this page.
              </p>
              <div className="wm-panel">
                <p style={{ marginTop: 0 }}>
                  <strong>1.</strong> Install and generate a token
                </p>
                <pre className="wm-result">{`bun add -g @thegreataxios/webmcp-bridge
openssl rand -hex 32
# copy the output; do not commit it`}</pre>
                <p>
                  <strong>2.</strong> Add a user-level Cursor MCP server (keep
                  the token out of repository files)
                </p>
                <pre className="wm-result">{`{
  "mcpServers": {
    "webmcp": {
      "command": "webmcp-bridge",
      "env": {
        "WEBMCP_BRIDGE_TOKEN": "<paste the generated token>"
      }
    }
  }
}`}</pre>
                <p style={{ marginBottom: 0 }}>
                  <strong>3.</strong> Restart the MCP server, paste that same
                  token above, and ask Cursor to call{" "}
                  <span className="wm-mono">ping</span>.
                </p>
              </div>
            </section>

            <section className="wm-section">
              <h2>Last bridge tool call</h2>
              <div className="wm-panel">
                {last ? (
                  <p
                    className="wm-fade-in"
                    style={{ margin: 0 }}
                    key={last}
                    role="status"
                    aria-live="polite"
                  >
                    {last}
                  </p>
                ) : (
                  <p className="wm-empty" style={{ margin: 0 }}>
                    Waiting for Cursor (or console) to call <span className="wm-mono">ping</span> /{" "}
                    <span className="wm-mono">echo</span>.
                  </p>
                )}
              </div>
              {native ? (
                <p style={{ marginTop: "1rem" }} className="wm-muted">
                  This bridge depends on the polyfill-only testing API. Native
                  WebMCP inspection is unavailable in this demo.
                </p>
              ) : (
                <>
                  <p style={{ marginTop: "1rem" }} className="wm-muted">
                    Without the bridge, you can still exercise tools locally:
                  </p>
                  <pre className="wm-result">{`await navigator.modelContextTesting.executeTool(
  "ping",
  JSON.stringify({}),
)`}</pre>
                </>
              )}
            </section>
          </main>

          <footer className="wm-footer">webmcp examples · bridge · MIT</footer>
        </div>
      </div>
    </>
  );
}

function TokenGate({
  initial,
  onSave,
}: {
  initial: string;
  onSave: (token: string) => void;
}) {
  const [value, setValue] = useState(initial);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const token = value.trim();
    if (!token) return;
    localStorage.setItem(TOKEN_KEY, token);
    onSave(token);
  };

  return (
    <div className="wm-app">
      <div className="wm-page">
        <header className="wm-topbar wm-animate-in">
          <a className="wm-brand" href="/">
            web<span>mcp</span>
          </a>
          <span className="wm-chip" data-tone="warn">
            token required
          </span>
        </header>
        <main>
          <section className="wm-hero wm-animate-in-delay">
            <p className="wm-eyebrow">Bridge</p>
            <h1>Connect this page to the bridge.</h1>
            <p className="wm-lede">
              Paste the token from your user-level Cursor MCP configuration.
              Cursor launches the bridge; nothing leaves localhost.
            </p>
          </section>
          <section className="wm-section wm-animate-in-late">
            <form className="wm-panel" onSubmit={submit}>
              <p style={{ marginTop: 0 }}>
                Install with{" "}
                <span className="wm-mono">
                  bun add -g @thegreataxios/webmcp-bridge
                </span>
                , generate a token with{" "}
                <span className="wm-mono">openssl rand -hex 32</span>, and set
                it as <span className="wm-mono">WEBMCP_BRIDGE_TOKEN</span> in
                your user-level Cursor MCP server configuration.
              </p>
              <label htmlFor="token" style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                Same bridge token
              </label>
              <input
                id="token"
                name="token"
                type="password"
                className="wm-mono"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="paste token from webmcp-bridge"
                autoComplete="off"
                spellCheck={false}
                style={{
                  width: "100%",
                  padding: "0.75rem 0.85rem",
                  borderRadius: "var(--wm-radius-sm)",
                  border: "1px solid var(--wm-border-strong)",
                  background: "var(--wm-surface-solid)",
                  fontSize: "0.95rem",
                  marginBottom: "0.85rem",
                }}
              />
              <div className="wm-cta-row">
                <button type="submit" className="wm-btn wm-btn-primary" disabled={!value.trim()}>
                  Connect
                </button>
                <span className="wm-muted wm-mono">{DEFAULT_URL}</span>
              </div>
            </form>
          </section>
        </main>
        <footer className="wm-footer">webmcp examples · bridge · MIT</footer>
      </div>
    </div>
  );
}

export function App() {
  const [token, setToken] = useState(readInitialToken);

  const connected = useMemo(() => token.length > 0, [token]);

  if (!connected) {
    return <TokenGate initial={token} onSave={setToken} />;
  }

  return (
    <BridgeProvider token={token} url={DEFAULT_URL}>
      <WebMCPProvider name="webmcp-bridge-demo" version="0.1.0">
        <BridgeInner
          onClearToken={() => {
            localStorage.removeItem(TOKEN_KEY);
            setToken("");
          }}
        />
      </WebMCPProvider>
    </BridgeProvider>
  );
}
