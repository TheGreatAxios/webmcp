import "@thegreataxios/webmcp-examples-theme/theme.css";
import "@thegreataxios/webmcp-examples-theme/motion.css";
import {
  createPageBridgeClient,
  createToolRegistry,
  experimental_createJourneyRegistry,
  getRegistry,
  installPolyfill,
  isNativeModelContext,
  registerWebMCPElements,
  setJourneyRegistry,
  validateToolDescriptor,
} from "@thegreataxios/webmcp-core";

// No React here. Custom elements + direct document.modelContext calls.
registerWebMCPElements();

// Journey registry must be set before installPolyfill so journey
// switches also emit toolchange.
const journeys = experimental_createJourneyRegistry();
journeys.register({
  name: "focus",
  description: "Only note-taking while focused",
  tools: ["save_note"],
});
setJourneyRegistry(journeys);
installPolyfill();

const notes: string[] = [];
const controller = new AbortController();

async function boot() {
  const mc = document.modelContext;
  if (!mc) {
    document.getElementById("status")!.textContent = "modelContext unavailable";
    return;
  }

  await mc.registerTool(
    {
      name: "greet",
      description: "Greet someone by name.",
      inputSchema: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
      },
      annotations: { readOnlyHint: true },
      execute: async ({ name }) => ({
        content: [{ type: "text", text: `Hello, ${String(name ?? "stranger")}!` }],
      }),
    },
    { signal: controller.signal },
  );

  await mc.registerTool(
    {
      name: "save_note",
      description: "Save a short note to the page list.",
      inputSchema: {
        type: "object",
        properties: { text: { type: "string" } },
        required: ["text"],
      },
      execute: async ({ text }) => {
        notes.push(String(text ?? ""));
        renderNotes();
        return {
          content: [{ type: "text", text: `Saved (${notes.length} total)` }],
          structuredContent: { count: notes.length },
        };
      },
    },
    { signal: controller.signal },
  );

  mc.addEventListener("toolchange", refreshTools);
  refreshTools();
}

function exposedNames(): string[] {
  return navigator.modelContextTesting?.listTools().map((t) => t.name) ?? [];
}

function refreshTools() {
  const names = exposedNames();
  document.getElementById("status")!.textContent =
    `${isNativeModelContext() ? "native" : "polyfill"} · ${names.length} tool${names.length === 1 ? "" : "s"} exposed`;
  document.getElementById("tools")!.innerHTML = names
    .map((n) => `<span class="wm-chip wm-mono">${n}</span>`)
    .join(" ");
}

function renderNotes() {
  document.getElementById("notes")!.innerHTML =
    notes.length === 0
      ? `<p class="wm-empty" style="margin:0">No notes yet.</p>`
      : `<ul class="wm-list">${notes.map((n) => `<li><span></span><span>${n}</span></li>`).join("")}</ul>`;
}

async function callTool(name: string, args: Record<string, unknown>) {
  const testing = navigator.modelContextTesting;
  const out = document.getElementById("result")!;
  if (!testing) {
    out.textContent = "Native browser: use an agent client to call tools.";
    return;
  }
  try {
    out.textContent = await testing.executeTool(name, JSON.stringify(args));
  } catch (err) {
    out.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
  refreshTools();
}

function demoValidation() {
  const out = document.getElementById("validation")!;
  try {
    validateToolDescriptor({
      name: "bad name!",
      description: "",
      execute: async () => ({ content: [] }),
    });
    out.textContent = "Unexpectedly valid.";
  } catch (err) {
    out.textContent = `Rejected: ${err instanceof Error ? err.message : String(err)}`;
  }
}

function demoRegistry() {
  const out = document.getElementById("registry")!;
  const lines: string[] = [];
  const registry = createToolRegistry();
  lines.push(`empty: ${registry.listTools().length} tools`);
  void registry
    .register({
      name: "temp",
      description: "Temporary demo tool.",
      execute: async () => ({ content: [{ type: "text", text: "temp" }] }),
    })
    .then(() => {
      lines.push(`after register: ${registry.listTools().map((t) => t.name).join(",")}`);
      registry.unregister("temp");
      lines.push(`after unregister: ${registry.listTools().length} tools`);
      lines.push(`polyfill registry: ${getRegistry()?.listTools().length ?? 0} tools live`);
      out.textContent = lines.join("\n");
    });
}

function connectBridge(token: string) {
  const status = document.getElementById("bridge-status")!;
  const client = createPageBridgeClient({
    url: "ws://127.0.0.1:17321/ws",
    token,
    onStatusChange: (next) => {
      status.textContent = `bridge · ${next}`;
    },
  });
  client.connect();
}

document.getElementById("root")!.innerHTML = `
<div class="wm-app"><div class="wm-page">
  <header class="wm-topbar wm-animate-in">
    <a class="wm-brand" href="/">web<span>mcp</span></a>
    <div class="wm-kicker"><span class="wm-chip" data-tone="ok" role="status" id="status">starting…</span></div>
  </header>
  <main>
    <section class="wm-hero wm-animate-in-delay">
      <p class="wm-eyebrow">Vanilla</p>
      <h1>No React. Just the platform.</h1>
      <p class="wm-lede">Custom elements, direct
        <span class="wm-mono">document.modelContext</span> calls, and the core
        registry — the same tools agents see, wired by hand.</p>
      <div class="wm-cta-row" id="tools"></div>
    </section>
    <section class="wm-section wm-animate-in-late">
      <h2>Greet</h2>
      <form class="wm-panel" id="greet-form">
        <label for="greet-name" style="display:block;font-weight:600;margin-bottom:0.5rem">Name</label>
        <input id="greet-name" name="name" class="wm-mono" value="Ada" autocomplete="off"
          style="width:100%;padding:0.75rem 0.85rem;border-radius:var(--wm-radius-sm);border:1px solid var(--wm-border-strong);background:var(--wm-surface-solid);font-size:0.95rem;margin-bottom:0.85rem" />
        <button type="submit" class="wm-btn wm-btn-primary">Call greet</button>
      </form>
    </section>
    <section class="wm-section">
      <h2>Notes</h2>
      <form class="wm-panel" id="note-form" style="margin-bottom:1rem">
        <label for="note-text" style="display:block;font-weight:600;margin-bottom:0.5rem">Note</label>
        <input id="note-text" name="text" class="wm-mono" placeholder="something worth keeping" autocomplete="off"
          style="width:100%;padding:0.75rem 0.85rem;border-radius:var(--wm-radius-sm);border:1px solid var(--wm-border-strong);background:var(--wm-surface-solid);font-size:0.95rem;margin-bottom:0.85rem" />
        <div class="wm-cta-row">
          <button type="submit" class="wm-btn wm-btn-primary">Call save_note</button>
          <button type="button" class="wm-btn wm-btn-ghost" id="journey-toggle" aria-pressed="false">Focus journey: off</button>
        </div>
      </form>
      <div class="wm-panel" id="notes"></div>
    </section>
    <section class="wm-section">
      <h2>Last result</h2>
      <div class="wm-panel"><pre class="wm-result" id="result" style="margin:0">No calls yet.</pre></div>
    </section>
    <section class="wm-section">
      <h2>Validation</h2>
      <p>Bad descriptors are rejected before they reach the registry.</p>
      <div class="wm-cta-row" style="margin-bottom:1rem">
        <button type="button" class="wm-btn wm-btn-ghost" id="validate-btn">Register bad tool</button>
      </div>
      <div class="wm-panel"><pre class="wm-result" id="validation" style="margin:0">Not run yet.</pre></div>
    </section>
    <section class="wm-section">
      <h2>Standalone registry</h2>
      <p>A registry outside the polyfill, for tests and embeds.</p>
      <div class="wm-cta-row" style="margin-bottom:1rem">
        <button type="button" class="wm-btn wm-btn-ghost" id="registry-btn">Run registry demo</button>
      </div>
      <div class="wm-panel"><pre class="wm-result" id="registry" style="margin:0">Not run yet.</pre></div>
    </section>
    <section class="wm-section">
      <h2>Bridge, no React</h2>
      <p>Same <span class="wm-mono">createPageBridgeClient</span> the React provider wraps.</p>
      <form class="wm-panel" id="bridge-form">
        <label for="bridge-token" style="display:block;font-weight:600;margin-bottom:0.5rem">Bridge token</label>
        <input id="bridge-token" name="token" type="password" class="wm-mono" autocomplete="off" spellcheck="false"
          style="width:100%;padding:0.75rem 0.85rem;border-radius:var(--wm-radius-sm);border:1px solid var(--wm-border-strong);background:var(--wm-surface-solid);font-size:0.95rem;margin-bottom:0.85rem" />
        <div class="wm-cta-row">
          <button type="submit" class="wm-btn wm-btn-primary">Connect</button>
          <span class="wm-muted wm-mono" id="bridge-status">bridge · disconnected</span>
        </div>
      </form>
    </section>
    <section class="wm-section">
      <h2>Try it locally</h2>
      <pre class="wm-result">await navigator.modelContextTesting.listTools()
await navigator.modelContextTesting.executeTool("greet", JSON.stringify({ name: "Ada" }))</pre>
    </section>
  </main>
  <footer class="wm-footer">webmcp examples · vanilla · MIT</footer>
</div></div>`;

document.getElementById("greet-form")!.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = (document.getElementById("greet-name") as HTMLInputElement).value;
  void callTool("greet", { name });
});

document.getElementById("note-form")!.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = (document.getElementById("note-text") as HTMLInputElement).value;
  void callTool("save_note", { text });
});

document.getElementById("journey-toggle")!.addEventListener("click", (e) => {
  const btn = e.currentTarget as HTMLButtonElement;
  const active = btn.getAttribute("aria-pressed") !== "true";
  journeys.setJourneyActive("focus", active);
  btn.setAttribute("aria-pressed", String(active));
  btn.textContent = `Focus journey: ${active ? "on" : "off"}`;
});

document.getElementById("validate-btn")!.addEventListener("click", demoValidation);
document.getElementById("registry-btn")!.addEventListener("click", demoRegistry);

document.getElementById("bridge-form")!.addEventListener("submit", (e) => {
  e.preventDefault();
  const token = (document.getElementById("bridge-token") as HTMLInputElement).value.trim();
  if (token) connectBridge(token);
});

renderNotes();
void boot();
