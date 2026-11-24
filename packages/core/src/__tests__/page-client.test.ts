import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  cleanupPolyfill,
  createPageBridgeClient,
  installPolyfill,
  type BridgeClientMessage,
} from "../index";

class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.OPEN;
  sent: BridgeClientMessage[] = [];
  private listeners = new Map<string, Set<(ev: unknown) => void>>();

  constructor(public readonly url: string) {
    MockWebSocket.instances.push(this);
  }

  addEventListener(type: string, fn: (ev: unknown) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
  }

  send(raw: string) {
    this.sent.push(JSON.parse(raw) as BridgeClientMessage);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.emit("close", {});
  }

  emit(type: string, event: unknown) {
    this.listeners.get(type)?.forEach((fn) => fn(event));
  }

  receiveServer(msg: unknown) {
    this.emit("message", { data: JSON.stringify(msg) });
  }
}

const OriginalWebSocket = globalThis.WebSocket;

beforeEach(() => {
  MockWebSocket.instances = [];
  (globalThis as { WebSocket: unknown }).WebSocket = MockWebSocket;
  cleanupPolyfill();
  installPolyfill();
});

afterEach(() => {
  cleanupPolyfill();
  (globalThis as { WebSocket: unknown }).WebSocket = OriginalWebSocket;
});

describe("createPageBridgeClient (load-bearing lifecycle)", () => {
  test("authenticates, syncs tools, executes calls, and propagates cancel_tool", async () => {
    let observedAbort = false;
    await document.modelContext!.registerTool({
      name: "echo",
      description: "Echo",
      execute: async ({ text }) => ({ echoed: text }),
    });
    await document.modelContext!.registerTool({
      name: "hang",
      description: "Waits for cancel",
      execute: (_args, options) =>
        new Promise((_resolve, reject) => {
          options?.signal.addEventListener("abort", () => {
            observedAbort = true;
            reject(new DOMException("Cancelled", "AbortError"));
          });
        }),
    });

    const statuses: string[] = [];
    const client = createPageBridgeClient({
      url: "ws://127.0.0.1:17321/ws",
      token: "0123456789abcdef0123456789abcdef",
      onStatusChange: (s) => statuses.push(s),
    });
    client.connect();

    const ws = MockWebSocket.instances[0];
    expect(ws).toBeDefined();

    // Handshake
    ws.receiveServer({ type: "auth_required" });
    expect(ws.sent[0]).toEqual({ type: "auth", token: "0123456789abcdef0123456789abcdef" });

    ws.receiveServer({ type: "auth_ok" });
    await Promise.resolve();
    await Promise.resolve();
    expect(statuses).toContain("connected");
    const syncMsg = ws.sent.find((m) => m.type === "sync_tools");
    expect(syncMsg).toBeDefined();

    // Execute tool -> tool_result
    ws.receiveServer({ type: "execute_tool", id: "req-1", name: "echo", args: { text: "hi" } });
    await new Promise((r) => setTimeout(r, 15));
    expect(ws.sent).toContainEqual({
      type: "tool_result",
      id: "req-1",
      result: { echoed: "hi" },
    });

    // Cancel in-flight tool via cancel_tool frame
    ws.receiveServer({ type: "execute_tool", id: "req-2", name: "hang", args: {} });
    await new Promise((r) => setTimeout(r, 10));
    ws.receiveServer({ type: "cancel_tool", id: "req-2" });
    await new Promise((r) => setTimeout(r, 15));
    expect(observedAbort).toBe(true);

    client.disconnect();
    expect(client.getStatus()).toBe("disconnected");
  });
});
