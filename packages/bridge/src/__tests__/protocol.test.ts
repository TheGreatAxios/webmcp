import { describe, expect, test } from "bun:test";
import { parseClientMessage, parseServerMessage } from "../protocol";

describe("parseClientMessage", () => {
  test("parses auth message", () => {
    const msg = parseClientMessage(JSON.stringify({ type: "auth", token: "abc" }));
    expect(msg).toEqual({ type: "auth", token: "abc" });
  });

  test("parses sync_tools message", () => {
    const msg = parseClientMessage(
      JSON.stringify({
        type: "sync_tools",
        tools: [{ name: "ping", description: "Ping" }],
      }),
    );
    expect(msg.type).toBe("sync_tools");
    if (msg.type === "sync_tools") {
      expect(msg.tools[0].name).toBe("ping");
    }
  });
});

describe("parseServerMessage", () => {
  test("parses execute_tool message", () => {
    const msg = parseServerMessage(
      JSON.stringify({ type: "execute_tool", id: "1", name: "ping", args: {} }),
    );
    expect(msg).toEqual({ type: "execute_tool", id: "1", name: "ping", args: {} });
  });
});
