import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import {
  cleanupPolyfill,
  experimental_createJourneyRegistry,
  installPolyfill,
} from "../index";

beforeEach(() => {
  (globalThis as { document: Document }).document = {} as Document;
  (globalThis as { navigator: Navigator }).navigator = {} as Navigator;
});

afterEach(() => {
  cleanupPolyfill();
});

describe("polyfill", () => {
  test("installs document.modelContext", () => {
    const installed = installPolyfill();
    expect(installed).toBe(true);
    expect(document.modelContext).toBeDefined();
  });
});

describe("experimental_createJourneyRegistry", () => {
  test("filters tools by active journey", () => {
    const registry = experimental_createJourneyRegistry();
    registry.register({
      name: "buying",
      tools: ["search", "add_to_cart"],
    });
    registry.setJourneyActive("buying", true);
    expect(registry.isToolExposed("search")).toBe(true);
    expect(registry.isToolExposed("checkout")).toBe(false);
  });
});
