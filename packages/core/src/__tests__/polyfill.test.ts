import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import {
  cleanupPolyfill,
  experimental_createJourneyRegistry,
  installPolyfill,
  listBridgeToolSummaries,
  setJourneyRegistry,
} from "../index";

beforeEach(() => {
  cleanupPolyfill();
});

afterEach(() => {
  cleanupPolyfill();
  setJourneyRegistry(null);
});

describe("polyfill", () => {
  test("installs document.modelContext and testing shim", () => {
    expect(installPolyfill()).toBe(true);
    expect(document.modelContext).toBeDefined();
    expect(navigator.modelContextTesting).toBeDefined();
  });

  test("refcounts provider installs", () => {
    installPolyfill();
    installPolyfill();
    cleanupPolyfill();
    expect(document.modelContext).toBeDefined();
    cleanupPolyfill();
    expect(document.modelContext).toBeUndefined();
  });

  test("executes tools via testing shim", async () => {
    installPolyfill();
    await document.modelContext!.registerTool({
      name: "echo",
      description: "Echo",
      execute: async ({ text }) => ({
        content: [{ type: "text", text: String(text) }],
      }),
    });
    const raw = await navigator.modelContextTesting!.executeTool(
      "echo",
      JSON.stringify({ text: "hi" }),
    );
    expect(JSON.parse(raw!)).toMatchObject({ content: [{ text: "hi" }] });
  });

  test("exposes Tool snapshots via getTools() and executes via executeTool()", async () => {
    installPolyfill();
    const controller = new AbortController();
    await document.modelContext!.registerTool(
      {
        name: "book_flight",
        title: "Book Flight",
        description: "Books a flight",
        inputSchema: { type: "object", properties: { dest: { type: "string" } } },
        outputSchema: { type: "object", properties: { confirmation: { type: "string" } } },
        annotations: { consequentialHint: true, debugging: false },
        execute: async ({ dest }) => ({ confirmation: `CONF-${String(dest)}` }),
      },
      { signal: controller.signal },
    );

    const tools = await document.modelContext!.getTools();
    expect(tools).toHaveLength(1);
    const [tool] = tools;
    expect(tool.name).toBe("book_flight");
    expect(tool.title).toBe("Book Flight");
    expect(tool.outputSchema).toEqual({ type: "object", properties: { confirmation: { type: "string" } } });
    expect(tool.annotations).toEqual({
      readOnlyHint: false,
      untrustedContentHint: false,
      consequentialHint: true,
      debugging: false,
    });

    const raw = await document.modelContext!.executeTool(tool, { dest: "SFO" });
    expect(JSON.parse(raw)).toEqual({ confirmation: "CONF-SFO" });

    // Stale Tool snapshot fails after unregistration, even if re-registered under same name
    controller.abort();
    await document.modelContext!.registerTool({
      name: "book_flight",
      description: "Re-registered",
      execute: async () => ({ ok: true }),
    });
    await expect(document.modelContext!.executeTool(tool, { dest: "LAX" })).rejects.toThrow(
      /no longer registered/,
    );
  });
});

describe("journey filtering", () => {
  test("hides tools outside active journey", async () => {
    installPolyfill();
    const journeys = experimental_createJourneyRegistry();
    setJourneyRegistry(journeys);
    journeys.register({ name: "buy", tools: ["add_to_cart"] });
    journeys.setJourneyActive("buy", true);

    await document.modelContext!.registerTool({
      name: "add_to_cart",
      description: "Add",
      execute: async () => ({ content: [{ type: "text", text: "ok" }] }),
    });
    await document.modelContext!.registerTool({
      name: "checkout",
      description: "Checkout",
      execute: async () => ({ content: [{ type: "text", text: "ok" }] }),
    });

    const exposed = listBridgeToolSummaries().map((t) => t.name);
    expect(exposed).toContain("add_to_cart");
    expect(exposed).not.toContain("checkout");
  });
});
