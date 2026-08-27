import { describe, expect, test } from "bun:test";
import { act, render, waitFor } from "@testing-library/react";
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
      add_item: (state, { sku }) => ({
        ...state,
        items: [...state.items, String(sku)],
      }),
    },
  });

  return (
    <>
      {cart.Tools}
      <span data-testid="count">{cart.state.items.length}</span>
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

    await navigator.modelContextTesting!.executeTool(
      "add_item",
      JSON.stringify({ sku: "sku-1" }),
    );

    await waitFor(() => {
      expect(document.querySelector("[data-testid='count']")?.textContent).toBe("1");
    });
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
});
