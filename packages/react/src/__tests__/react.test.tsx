import { describe, expect, test } from "bun:test";
import { act, render, waitFor } from "@testing-library/react";
import { useReducer, useState } from "react";
import {
  WebMCPProvider,
  WebMCPTool,
  experimental_WebMCPConfirmProvider,
  experimental_WebMCPGuardedTool,
  experimental_WebMCPJourney,
  experimental_useWebMCPSync,
  experimental_useWebMCPConfirm,
  useWebMCP,
} from "../index";

const Journey = experimental_WebMCPJourney;
const ConfirmProvider = experimental_WebMCPConfirmProvider;
const GuardedTool = experimental_WebMCPGuardedTool;

function SyncDemo() {
  const cart = experimental_useWebMCPSync({
    initial: { items: [] as string[] },
    tools: {
      add_item: {
        description: "Add an item by SKU",
        inputSchema: {
          type: "object",
          properties: { sku: { type: "string" } },
          required: ["sku"],
        },
        reducer: (state, { sku }) => ({
          ...state,
          items: [...state.items, String(sku)],
        }),
      },
    },
  });

  return (
    <>
      {cart.Tools}
      <span data-testid="count">{cart.state.items.length}</span>
    </>
  );
}

function ConcurrentSyncDemo() {
  const counter = experimental_useWebMCPSync({
    initial: { count: 0 },
    tools: {
      increment: async (state, { delay }) => {
        if (delay) await new Promise((resolve) => setTimeout(resolve, 10));
        return { count: state.count + 1 };
      },
      reject_mutation: () => {
        throw new Error("Invalid mutation");
      },
    },
  });

  return (
    <>
      {counter.Tools}
      <button type="button" data-testid="set-count" onClick={() => counter.setState({ count: 5 })}>
        Set count
      </button>
      <span data-testid="sync-count">{counter.state.count}</span>
    </>
  );
}

function JourneyStabilityDemo() {
  const [phase, setPhase] = useState<"a" | "b">("a");
  const [, rerender] = useReducer((value) => value + 1, 0);

  return (
    <>
      <button type="button" data-testid="journey-rerender" onClick={rerender}>
        Rerender
      </button>
      <button type="button" data-testid="journey-switch" onClick={() => setPhase("b")}>
        Switch
      </button>
      <Journey name="phase-a" tools={["phase_a"]} when={phase === "a"}>
        <WebMCPTool
          name="phase_a"
          description="Phase A"
          handler={async () => ({ content: [{ type: "text", text: "a" }] })}
        />
      </Journey>
      <Journey name="phase-b" tools={["phase_b"]} when={phase === "b"}>
        <WebMCPTool
          name="phase_b"
          description="Phase B"
          handler={async () => ({ content: [{ type: "text", text: "b" }] })}
        />
      </Journey>
    </>
  );
}

describe("WebMCPProvider", () => {
  test("marks modelContext available", async () => {
    let available = false;
    function Probe() {
      available = useWebMCP().available;
      return null;
    }
    render(
      <WebMCPProvider name="test" version="0.0.0">
        <Probe />
      </WebMCPProvider>,
    );
    await waitFor(() => expect(available).toBe(true));
  });
});

describe("WebMCPTool", () => {
  test("registers tool on modelContext", async () => {
    render(
      <WebMCPProvider name="test" version="0.0.0">
        <WebMCPTool
          name="greet"
          description="Greet"
          handler={async ({ name }) => ({
            content: [{ type: "text", text: `hi ${name}` }],
          })}
        />
      </WebMCPProvider>,
    );

    await waitFor(() => {
      expect(navigator.modelContextTesting?.listTools().some((t) => t.name === "greet")).toBe(true);
    });

    const result = await navigator.modelContextTesting!.executeTool(
      "greet",
      JSON.stringify({ name: "Sawyer" }),
    );
    expect(JSON.parse(result!)).toMatchObject({
      content: [{ text: "hi Sawyer" }],
    });
  });
});

describe("experimental_useWebMCPSync", () => {
  test("updates state when tool executes", async () => {
    render(
      <WebMCPProvider name="test" version="0.0.0">
        <SyncDemo />
      </WebMCPProvider>,
    );

    await waitFor(() => expect(navigator.modelContextTesting?.listTools().length).toBeGreaterThan(0));

    await act(async () => {
      await navigator.modelContextTesting!.executeTool(
        "add_item",
        JSON.stringify({ sku: "sku-1" }),
      );
    });

    await waitFor(() => {
      expect(document.querySelector("[data-testid='count']")?.textContent).toBe("1");
    });

    const tool = navigator.modelContextTesting!.listTools().find((item) => item.name === "add_item");
    expect(tool?.description).toBe("Add an item by SKU");
    expect(JSON.parse(tool!.inputSchema!)).toMatchObject({
      properties: { sku: { type: "string" } },
    });
  });

  test("serializes overlapping mutations and reads direct state updates", async () => {
    render(
      <WebMCPProvider name="test" version="0.0.0">
        <ConcurrentSyncDemo />
      </WebMCPProvider>,
    );

    await waitFor(() =>
      expect(
        navigator.modelContextTesting?.listTools().some((tool) => tool.name === "increment"),
      ).toBe(true),
    );

    const first = navigator.modelContextTesting!.executeTool(
      "increment",
      JSON.stringify({ delay: true }),
    );
    const second = navigator.modelContextTesting!.executeTool("increment", "{}");
    await act(async () => {
      await Promise.all([first, second]);
    });
    expect(document.querySelector("[data-testid='sync-count']")?.textContent).toBe("2");

    act(() => {
      (document.querySelector("[data-testid='set-count']") as HTMLButtonElement).click();
    });
    await act(async () => {
      await navigator.modelContextTesting!.executeTool("increment", "{}");
    });
    expect(document.querySelector("[data-testid='sync-count']")?.textContent).toBe("6");

    const rejected = await navigator.modelContextTesting!.executeTool("reject_mutation", "{}");
    expect(JSON.parse(rejected!)).toMatchObject({
      content: [{ text: "Invalid mutation" }],
      isError: true,
    });
    expect(document.querySelector("[data-testid='sync-count']")?.textContent).toBe("6");
  });
});

describe("experimental_WebMCPJourney", () => {
  test("limits exposed tools", async () => {
    render(
      <WebMCPProvider name="test" version="0.0.0">
        <Journey name="buy" tools={["allowed"]}>
          <WebMCPTool
            name="allowed"
            description="Allowed"
            handler={async () => ({ content: [{ type: "text", text: "ok" }] })}
          />
          <WebMCPTool
            name="hidden"
            description="Hidden"
            handler={async () => ({ content: [{ type: "text", text: "ok" }] })}
          />
        </Journey>
      </WebMCPProvider>,
    );

    await waitFor(() => expect(navigator.modelContextTesting?.listTools().length).toBe(1));
    const names = navigator.modelContextTesting!.listTools().map((t) => t.name);
    expect(names).toContain("allowed");
    expect(names).not.toContain("hidden");
  });

  test("ignores fresh equivalent tool arrays and switches phases without churn", async () => {
    render(
      <WebMCPProvider name="test" version="0.0.0">
        <JourneyStabilityDemo />
      </WebMCPProvider>,
    );

    await waitFor(() =>
      expect(navigator.modelContextTesting?.listTools().map((tool) => tool.name)).toEqual([
        "phase_a",
      ]),
    );

    let changes = 0;
    navigator.modelContextTesting!.registerToolsChangedCallback(() => changes++);
    act(() => {
      (document.querySelector("[data-testid='journey-rerender']") as HTMLButtonElement).click();
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(changes).toBe(0);

    act(() => {
      (document.querySelector("[data-testid='journey-switch']") as HTMLButtonElement).click();
    });
    await waitFor(() =>
      expect(navigator.modelContextTesting?.listTools().map((tool) => tool.name)).toEqual([
        "phase_b",
      ]),
    );
    expect(changes).toBeGreaterThan(0);
    expect(changes).toBeLessThanOrEqual(4);
  });
});

describe("experimental_WebMCPConfirm", () => {
  test("runs guarded tool after approval", async () => {
    function Harness() {
      const { pending } = experimental_useWebMCPConfirm();
      return (
        <>
          <GuardedTool
            name="delete_item"
            description="Delete"
            handler={async () => ({ content: [{ type: "text", text: "deleted" }] })}
          />
          {pending ? (
            <button type="button" data-testid="approve" onClick={() => pending.approve()}>
              approve
            </button>
          ) : null}
        </>
      );
    }

    render(
      <WebMCPProvider name="test" version="0.0.0">
        <ConfirmProvider>
          <Harness />
        </ConfirmProvider>
      </WebMCPProvider>,
    );

    await waitFor(() =>
      expect(navigator.modelContextTesting?.listTools().some((t) => t.name === "delete_item")).toBe(
        true,
      ),
    );

    let execPromise!: Promise<string | null | undefined>;
    await act(async () => {
      execPromise = navigator.modelContextTesting!.executeTool(
        "delete_item",
        JSON.stringify({ id: "1" }),
      );
    });

    await waitFor(() => {
      expect(document.querySelector("[data-testid='approve']")).not.toBeNull();
    });

    await act(async () => {
      (document.querySelector("[data-testid='approve']") as HTMLButtonElement).click();
    });

    const raw = await execPromise;
    expect(JSON.parse(raw!)).toMatchObject({ content: [{ text: "deleted" }] });
  });

  test("queues overlapping calls and settles each resolver", async () => {
    function Harness() {
      const { pending } = experimental_useWebMCPConfirm();
      return (
        <>
          <GuardedTool
            name="queued_delete"
            description="Delete in order"
            handler={async ({ id }) => ({
              content: [{ type: "text", text: `deleted ${id}` }],
            })}
          />
          {pending ? (
            <>
              <span data-testid="pending-id">{String(pending.args.id)}</span>
              <button type="button" data-testid="queue-approve" onClick={pending.approve}>
                Approve
              </button>
              <button type="button" data-testid="queue-reject" onClick={() => pending.reject()}>
                Reject
              </button>
            </>
          ) : null}
        </>
      );
    }

    render(
      <WebMCPProvider name="test" version="0.0.0">
        <ConfirmProvider>
          <Harness />
        </ConfirmProvider>
      </WebMCPProvider>,
    );
    await waitFor(() =>
      expect(
        navigator.modelContextTesting?.listTools().some((tool) => tool.name === "queued_delete"),
      ).toBe(true),
    );

    let first!: Promise<string | null>;
    let second!: Promise<string | null>;
    act(() => {
      first = navigator.modelContextTesting!.executeTool(
        "queued_delete",
        JSON.stringify({ id: "first" }),
      );
      second = navigator.modelContextTesting!.executeTool(
        "queued_delete",
        JSON.stringify({ id: "second" }),
      );
    });
    await waitFor(() =>
      expect(document.querySelector("[data-testid='pending-id']")?.textContent).toBe("first"),
    );
    await act(async () => {
      (document.querySelector("[data-testid='queue-approve']") as HTMLButtonElement).click();
      await Promise.resolve();
    });
    await waitFor(() =>
      expect(document.querySelector("[data-testid='pending-id']")?.textContent).toBe("second"),
    );
    await act(async () => {
      (document.querySelector("[data-testid='queue-reject']") as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(JSON.parse((await first)!)).toMatchObject({
      content: [{ text: "deleted first" }],
    });
    expect(JSON.parse((await second)!)).toMatchObject({
      content: [{ text: "User declined" }],
      isError: true,
    });
  });

  test("rejects pending calls when the provider unmounts", async () => {
    function Harness() {
      return (
        <GuardedTool
          name="unmount_delete"
          description="Delete after confirmation"
          handler={async () => ({ content: [{ type: "text", text: "deleted" }] })}
        />
      );
    }

    const view = render(
      <WebMCPProvider name="test" version="0.0.0">
        <ConfirmProvider>
          <Harness />
        </ConfirmProvider>
      </WebMCPProvider>,
    );
    await waitFor(() =>
      expect(
        navigator.modelContextTesting?.listTools().some((tool) => tool.name === "unmount_delete"),
      ).toBe(true),
    );

    let result!: Promise<string | null>;
    act(() => {
      result = navigator.modelContextTesting!.executeTool("unmount_delete", "{}");
    });
    act(() => view.unmount());

    expect(JSON.parse((await result)!)).toMatchObject({
      content: [{ text: "User declined" }],
      isError: true,
    });
  });

  test("fails closed without a confirmation provider", async () => {
    let executed = false;
    render(
      <WebMCPProvider name="test" version="0.0.0">
        <GuardedTool
          name="unprovided_delete"
          description="Never run without confirmation"
          handler={async () => {
            executed = true;
            return { content: [{ type: "text", text: "deleted" }] };
          }}
        />
      </WebMCPProvider>,
    );
    await waitFor(() =>
      expect(
        navigator.modelContextTesting
          ?.listTools()
          .some((tool) => tool.name === "unprovided_delete"),
      ).toBe(true),
    );

    const raw = await navigator.modelContextTesting!.executeTool("unprovided_delete", "{}");
    expect(JSON.parse(raw!)).toMatchObject({
      content: [{ text: "Confirmation provider unavailable" }],
      isError: true,
    });
    expect(executed).toBe(false);
  });
});
