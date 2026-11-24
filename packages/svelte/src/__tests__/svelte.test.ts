import { afterEach, describe, expect, test } from "bun:test";
import { get } from "svelte/store";
import { awaitToolsStable } from "@thegreataxios/webmcp-core";
import {
  createWebMCPProvider,
  experimental_useWebMCPJourney,
  experimental_useWebMCPSync,
  useWaitForToolsUntil,
  useWebMCPTool,
} from "../index";

let activeProvider: ReturnType<typeof createWebMCPProvider> | null = null;

afterEach(() => {
  activeProvider?.destroy();
  activeProvider = null;
});

describe("@thegreataxios/webmcp-svelte", () => {
  test("createWebMCPProvider and useWebMCPTool manage lifecycle and AbortSignal", async () => {
    activeProvider = createWebMCPProvider({ name: "svelte-app", version: "1.0.0" });
    expect(activeProvider.available).toBe(true);

    let sawSignal = false;
    const handle = useWebMCPTool({
      name: "greet",
      title: "Greet",
      description: "Greets a user",
      outputSchema: { type: "object", properties: { greeting: { type: "string" } } },
      annotations: { readOnlyHint: true },
      handler: async ({ who }, options) => {
        sawSignal = options?.signal instanceof AbortSignal;
        return { greeting: `Hello ${String(who)}` };
      },
    });

    const [tool] = await document.modelContext!.getTools();
    expect(tool.name).toBe("greet");
    const raw = await document.modelContext!.executeTool(tool, { who: "Svelte" });
    expect(JSON.parse(raw)).toEqual({ greeting: "Hello Svelte" });
    expect(sawSignal).toBe(true);

    handle.dispose();
    expect(await document.modelContext!.getTools()).toHaveLength(0);
  });

  test("experimental_useWebMCPSync updates Svelte store when tool executes", async () => {
    activeProvider = createWebMCPProvider({ name: "svelte-sync" });
    const counter = experimental_useWebMCPSync({
      initial: { count: 0 },
      tools: {
        increment: {
          description: "Increment count",
          reducer: (state, { by }) => ({ count: state.count + Number(by ?? 1) }),
        },
      },
    });

    const [tool] = await document.modelContext!.getTools();
    await document.modelContext!.executeTool(tool, { by: 3 });
    expect(get(counter.state)).toEqual({ count: 3 });
    counter.dispose();
  });

  test("experimental_useWebMCPJourney filters exposed tools", async () => {
    activeProvider = createWebMCPProvider({ name: "svelte-journey" });
    const t1 = useWebMCPTool({
      name: "browse",
      description: "Browse",
      handler: async () => ({}),
    });
    const t2 = useWebMCPTool({
      name: "pay",
      description: "Pay",
      handler: async () => ({}),
    });

    const journey = experimental_useWebMCPJourney({
      name: "checkout",
      tools: ["pay"],
      active: true,
      registry: activeProvider.journeyRegistry,
    });

    const exposed = (await document.modelContext!.getTools()).map((t) => t.name);
    expect(exposed).toEqual(["pay"]);

    journey.dispose();
    t1.dispose();
    t2.dispose();
  });

  test("useWaitForToolsUntil integrates with awaitToolsStable", async () => {
    activeProvider = createWebMCPProvider({ name: "svelte-stable" });
    let done = false;
    useWaitForToolsUntil(
      new Promise<void>((r) =>
        setTimeout(() => {
          done = true;
          r();
        }, 10),
      ),
    );
    await awaitToolsStable();
    expect(done).toBe(true);
  });
});
