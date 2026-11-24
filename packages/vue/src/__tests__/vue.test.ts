import { afterEach, describe, expect, test } from "bun:test";
import { effectScope } from "vue";
import { awaitToolsStable } from "@thegreataxios/webmcp-core";
import {
  experimental_useWebMCPJourney,
  experimental_useWebMCPSync,
  provideWebMCP,
  useWaitForToolsUntil,
  useWebMCPTool,
} from "../index";

let activeScope: ReturnType<typeof effectScope> | null = null;

afterEach(() => {
  activeScope?.stop();
  activeScope = null;
});

describe("@thegreataxios/webmcp-vue", () => {
  test("provideWebMCP and useWebMCPTool clean up automatically on effectScope stop", async () => {
    activeScope = effectScope();
    let sawSignal = false;

    activeScope.run(() => {
      const ctx = provideWebMCP({ name: "vue-app", version: "1.0.0" });
      expect(ctx.available).toBe(true);

      useWebMCPTool({
        name: "greet_vue",
        title: "Greet Vue",
        description: "Greets from Vue",
        outputSchema: { type: "object", properties: { msg: { type: "string" } } },
        annotations: { readOnlyHint: true },
        handler: async ({ who }, options) => {
          sawSignal = options?.signal instanceof AbortSignal;
          return { msg: `Hi ${String(who)}` };
        },
      });
    });

    const [tool] = await document.modelContext!.getTools();
    expect(tool.name).toBe("greet_vue");
    const raw = await document.modelContext!.executeTool(tool, { who: "Vue" });
    expect(JSON.parse(raw)).toEqual({ msg: "Hi Vue" });
    expect(sawSignal).toBe(true);

    activeScope.stop();
    activeScope = null;
    expect(document.modelContext).toBeUndefined();
  });

  test("experimental_useWebMCPSync updates Vue ref when tool executes", async () => {
    activeScope = effectScope();
    let sync!: ReturnType<typeof experimental_useWebMCPSync<{ count: number }>>;

    activeScope.run(() => {
      provideWebMCP({ name: "vue-sync" });
      sync = experimental_useWebMCPSync({
        initial: { count: 0 },
        tools: {
          add: {
            description: "Add to count",
            reducer: (s, { n }) => ({ count: s.count + Number(n ?? 1) }),
          },
        },
      });
    });

    const [tool] = await document.modelContext!.getTools();
    await document.modelContext!.executeTool(tool, { n: 5 });
    expect(sync.state.value).toEqual({ count: 5 });
  });

  test("experimental_useWebMCPJourney filters exposed tools and cleans up on dispose", async () => {
    activeScope = effectScope();

    activeScope.run(() => {
      const ctx = provideWebMCP({ name: "vue-journey" });
      useWebMCPTool({ name: "a", description: "A", handler: async () => ({}) });
      useWebMCPTool({ name: "b", description: "B", handler: async () => ({}) });
      experimental_useWebMCPJourney({
        name: "only-b",
        tools: ["b"],
        active: true,
        registry: ctx.journeyRegistry,
      });
    });

    const exposed = (await document.modelContext!.getTools()).map((t) => t.name);
    expect(exposed).toEqual(["b"]);
  });

  test("useWaitForToolsUntil integrates with awaitToolsStable", async () => {
    activeScope = effectScope();
    let settled = false;

    activeScope.run(() => {
      provideWebMCP({ name: "vue-stable" });
      useWaitForToolsUntil(
        new Promise<void>((r) =>
          setTimeout(() => {
            settled = true;
            r();
          }, 10),
        ),
      );
    });

    await awaitToolsStable();
    expect(settled).toBe(true);
  });
});
