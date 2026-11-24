import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { awaitToolsStable, cleanupPolyfill, installPolyfill } from "../index";

beforeEach(() => {
  cleanupPolyfill();
});

afterEach(() => {
  cleanupPolyfill();
});

describe("events, cancellation, and waitForToolsUntil", () => {
  test("fires toolactivated after invoking execute", async () => {
    installPolyfill();
    const order: string[] = [];

    document.modelContext!.addEventListener("toolactivated", (ev) => {
      order.push(`activated:${(ev as ToolActivatedEvent).toolName}`);
    });

    await document.modelContext!.registerTool({
      name: "slow_op",
      description: "Slow op",
      execute: async () => {
        order.push("execute:start");
        await Promise.resolve();
        order.push("execute:end");
        return { done: true };
      },
    });

    const [tool] = await document.modelContext!.getTools();
    await document.modelContext!.executeTool(tool, {});
    expect(order).toEqual(["execute:start", "activated:slow_op", "execute:end"]);
  });

  test("propagates AbortSignal to execute and fires toolcancel", async () => {
    installPolyfill();
    const cancelled: string[] = [];
    let observedAbort = false;

    document.modelContext!.addEventListener("toolcancel", (ev) => {
      cancelled.push((ev as ToolCancelEvent).toolName);
    });

    await document.modelContext!.registerTool({
      name: "cancellable",
      description: "Waits for abort",
      execute: (_args, options) =>
        new Promise((_resolve, reject) => {
          options?.signal.addEventListener("abort", () => {
            observedAbort = true;
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    });

    const [tool] = await document.modelContext!.getTools();
    const controller = new AbortController();
    const pending = document.modelContext!.executeTool(tool, {}, { signal: controller.signal });
    controller.abort();

    await expect(pending).rejects.toThrow(/Aborted/);
    expect(observedAbort).toBe(true);
    expect(cancelled).toEqual(["cancellable"]);
  });

  test("waitForToolsUntil tracks async hydration stability", async () => {
    installPolyfill();
    let hydrated = false;
    const hydration = new Promise<void>((resolve) => {
      setTimeout(() => {
        hydrated = true;
        resolve();
      }, 15);
    });

    document.modelContext!.waitForToolsUntil!(hydration);
    expect(hydrated).toBe(false);
    await awaitToolsStable();
    expect(hydrated).toBe(true);
  });
});
