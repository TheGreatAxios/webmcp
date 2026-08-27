import { describe, expect, test } from "bun:test";
import type { ServerWebSocket } from "bun";
import { PageSession } from "../session";

describe("PageSession", () => {
  test("stores tools after sync", () => {
    const session = new PageSession();
    const ws = createMockWs();
    session.setSocket(ws as unknown as ServerWebSocket<{ authenticated: boolean }>);

    session.handleMessage(
      JSON.stringify({ type: "auth", token: "secret" }),
      "secret",
    );
    session.handleMessage(
      JSON.stringify({
        type: "sync_tools",
        tools: [{ name: "ping", description: "Ping" }],
      }),
      "secret",
    );

    expect(session.getTools()).toHaveLength(1);
    expect(session.isConnected()).toBe(true);
  });

  test("rejects invalid auth token", () => {
    const session = new PageSession();
    const ws = createMockWs();
    session.setSocket(ws as unknown as ServerWebSocket<{ authenticated: boolean }>);

    session.handleMessage(JSON.stringify({ type: "auth", token: "wrong" }), "secret");
    expect(ws.closeCalled).toBe(true);
  });
});

function createMockWs() {
  const sent: string[] = [];
  let closeCalled = false;
  const ws = {
    data: { authenticated: false },
    readyState: WebSocket.OPEN,
    send: (msg: string) => sent.push(msg),
    close: () => {
      closeCalled = true;
    },
    closeCalled: false,
  };
  Object.defineProperty(ws, "closeCalled", {
    get: () => closeCalled,
  });
  return ws as typeof ws & { closeCalled: boolean };
}
