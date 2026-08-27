import { describe, expect, test } from "bun:test";
import { experimental_createJourneyRegistry } from "../experimental/journey";

describe("experimental_createJourneyRegistry", () => {
  test("filters by active journey", () => {
    const registry = experimental_createJourneyRegistry();
    registry.register({ name: "buying", tools: ["search", "add_to_cart"] });
    registry.setJourneyActive("buying", true);
    expect(registry.isToolExposed("search")).toBe(true);
    expect(registry.isToolExposed("checkout")).toBe(false);
  });

  test("exposes all when no journey active", () => {
    const registry = experimental_createJourneyRegistry();
    registry.register({ name: "buying", tools: ["search"] });
    expect(registry.isToolExposed("anything")).toBe(true);
  });

  test("notifies listeners on activation", () => {
    const registry = experimental_createJourneyRegistry();
    let n = 0;
    registry.addChangeListener(() => n++);
    registry.register({ name: "j", tools: ["a"] });
    registry.setJourneyActive("j", true);
    expect(n).toBe(2);
  });
});
