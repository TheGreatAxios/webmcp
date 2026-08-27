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
