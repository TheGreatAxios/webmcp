export function App() {
  return (
    <div className="wm-app">
      <div className="wm-page">
        <header className="wm-topbar wm-animate-in">
          <a className="wm-brand" href="/" aria-label="webmcp home">
            webmcp
          </a>
          <div className="wm-kicker">
            <span className="wm-chip" data-tone="accent">
              examples
            </span>
            <span className="wm-chip">shell · foundation</span>
          </div>
        </header>

        <main>
          <section className="wm-hero wm-animate-in-delay">
            <p className="wm-eyebrow">Shared theme</p>
            <h1>A quiet place to start.</h1>
            <p className="wm-lede">
              This blank shell proves the shared tokens, type, atmosphere, and
              motion used by every webmcp example. Feature demos stack on later
              branches.
            </p>
            <div className="wm-cta-row">
              <span className="wm-chip" data-tone="ok" role="status">
                Theme ready
              </span>
              <span className="wm-muted wm-mono">localhost:43109</span>
            </div>
          </section>

          <section className="wm-section wm-animate-in-late">
            <h2>What you get</h2>
            <p>
              Syne + Plus Jakarta Sans, cool mist surfaces, teal accent, and
              short entrance motions. No tools registered here — open{" "}
              <span className="wm-mono">examples/tools</span> once that stack
              lands.
            </p>
            <div className="wm-panel">
              <p className="wm-empty" style={{ margin: 0 }}>
                Waiting for the next example in the stack…
              </p>
            </div>
          </section>
        </main>

        <footer className="wm-footer">
          webmcp examples · foundation scaffold · MIT
        </footer>
      </div>
    </div>
  );
}
