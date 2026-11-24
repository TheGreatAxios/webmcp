import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { cleanupPolyfill, setJourneyRegistry } from "@thegreataxios/webmcp-core";
import { registerWebMCPElements, type WebMCPToolElementInstance } from "../index";

beforeEach(() => {
  registerWebMCPElements();
  document.body.innerHTML = "";
  cleanupPolyfill();
  setJourneyRegistry(null);
});

afterEach(() => {
  document.body.innerHTML = "";
  cleanupPolyfill();
  setJourneyRegistry(null);
});

describe("@thegreataxios/webmcp-elements", () => {
  test("<webmcp-provider> installs document.modelContext and emits webmcp-ready", () => {
    let ready = false;
    document.body.addEventListener("webmcp-ready", () => {
      ready = true;
    });

    const provider = document.createElement("webmcp-provider");
    document.body.appendChild(provider);

    expect(ready).toBe(true);
    expect(document.modelContext).toBeDefined();

    provider.remove();
    expect(document.modelContext).toBeUndefined();
  });

  test("<webmcp-tool> registers declarative tool with JSON slot schemas and execute property", async () => {
    const provider = document.createElement("webmcp-provider");
    const toolEl = document.createElement("webmcp-tool") as WebMCPToolElementInstance;
    toolEl.setAttribute("name", "lookup_order");
    toolEl.setAttribute("title", "Lookup Order");
    toolEl.setAttribute("description", "Fetches order status");
    toolEl.setAttribute("read-only", "");
    toolEl.innerHTML = `
      <script type="application/json" slot="input-schema">
        {"type":"object","properties":{"id":{"type":"string"}},"required":["id"]}
      </script>
      <script type="application/json" slot="output-schema">
        {"type":"object","properties":{"status":{"type":"string"}}}
      </script>
    `;
    toolEl.execute = async ({ id }) => ({ status: `shipped:${String(id)}` });

    provider.appendChild(toolEl);
    document.body.appendChild(provider);

    const tools = await document.modelContext!.getTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe("lookup_order");
    expect(tools[0].annotations?.readOnlyHint).toBe(true);
    expect(tools[0].outputSchema).toEqual({
      type: "object",
      properties: { status: { type: "string" } },
    });

    const raw = await document.modelContext!.executeTool(tools[0], { id: "42" });
    expect(JSON.parse(raw)).toEqual({ status: "shipped:42" });

    // Disconnecting unregisters cleanly
    toolEl.remove();
    expect(await document.modelContext!.getTools()).toHaveLength(0);
  });

  test("<webmcp-tool> supports declarative webmcp-execute event", async () => {
    const provider = document.createElement("webmcp-provider");
    const toolEl = document.createElement("webmcp-tool");
    toolEl.setAttribute("name", "ping_event");
    toolEl.setAttribute("description", "Handled via event");
    toolEl.addEventListener("webmcp-execute", (ev) => {
      const detail = (ev as CustomEvent).detail as {
        args: Record<string, unknown>;
        respondWith: (v: unknown) => void;
      };
      detail.respondWith({ pong: detail.args.msg });
    });

    provider.appendChild(toolEl);
    document.body.appendChild(provider);

    const [tool] = await document.modelContext!.getTools();
    const raw = await document.modelContext!.executeTool(tool, { msg: "hello" });
    expect(JSON.parse(raw)).toEqual({ pong: "hello" });
  });

  test("<webmcp-journey> scopes exposed tools when active attribute is present", async () => {
    const provider = document.createElement("webmcp-provider");
    const journey = document.createElement("webmcp-journey");
    journey.setAttribute("name", "checkout");
    journey.setAttribute("tools", "pay_now");
    journey.setAttribute("active", "");

    const pay = document.createElement("webmcp-tool") as WebMCPToolElementInstance;
    pay.setAttribute("name", "pay_now");
    pay.setAttribute("description", "Pay");
    pay.execute = async () => ({ paid: true });

    const browse = document.createElement("webmcp-tool") as WebMCPToolElementInstance;
    browse.setAttribute("name", "browse");
    browse.setAttribute("description", "Browse");
    browse.execute = async () => ({ items: [] });

    provider.append(journey, pay, browse);
    document.body.appendChild(provider);

    const tools = await document.modelContext!.getTools();
    expect(tools.map((t) => t.name)).toEqual(["pay_now"]);
  });
});
