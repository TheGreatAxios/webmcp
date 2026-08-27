import { describe, expect, test } from "bun:test";
import { createToolRegistry } from "../registry";

describe("createToolRegistry", () => {
  test("registers and lists tools", async () => {
    const registry = createToolRegistry();
    await registry.register({
      name: "ping",
      description: "Ping",
      execute: async () => ({ content: [{ type: "text" as const, text: "pong" }] }),
    });
    expect(registry.listTools()).toHaveLength(1);
    expect(registry.getTool("ping")?.name).toBe("ping");
  });

  test("rejects duplicate names", async () => {
    const registry = createToolRegistry();
    const tool = {
      name: "dup",
      description: "Dup",
      execute: async () => ({ content: [{ type: "text" as const, text: "ok" }] }),
    };
    await registry.register(tool);
    await expect(registry.register(tool)).rejects.toThrow(/already registered/);
  });

  test("unregisters on abort signal", async () => {
    const registry = createToolRegistry();
    const controller = new AbortController();
    await registry.register(
      {
        name: "temp",
        description: "Temp",
        execute: async () => ({ content: [{ type: "text" as const, text: "ok" }] }),
      },
      { signal: controller.signal },
    );
    controller.abort();
    expect(registry.getTool("temp")).toBeUndefined();
  });

  test("notifies change listeners", async () => {
    const registry = createToolRegistry();
    let count = 0;
    registry.addChangeListener(() => count++);
    await registry.register({
      name: "a",
      description: "A",
      execute: async () => ({ content: [{ type: "text" as const, text: "ok" }] }),
    });
    expect(count).toBe(1);
  });
});
