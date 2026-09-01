import { describe, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ToolListChangedNotificationSchema } from "@modelcontextprotocol/sdk/types.js";
import type { ServerWebSocket } from "bun";
import { createMcpBridge } from "../mcp-server";

describe("createMcpBridge", () => {
  test("advertises and sends tool list changes after page sync", async () => {
    const bridge = await createMcpBridge({ port: 0, token: "a".repeat(32) });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test", version: "0.0.0" });
    let notify: () => void = () => {};
    const notified = new Promise<void>((resolve) => {
      notify = resolve;
    });
    client.setNotificationHandler(ToolListChangedNotificationSchema, () => notify());

    try {
      await Promise.all([bridge.mcp.connect(serverTransport), client.connect(clientTransport)]);
      expect(client.getServerCapabilities()?.tools?.listChanged).toBe(true);
      expect((await client.listTools()).tools).toEqual([]);

      const ws = {
        data: { authenticated: false },
        readyState: WebSocket.OPEN,
        send() {},
        close() {},
      } as unknown as ServerWebSocket<{ authenticated: boolean }>;
      bridge.session.setSocket(ws);
      bridge.session.handleMessage(
        JSON.stringify({ type: "auth", token: "a".repeat(32) }),
        "a".repeat(32),
      );
      bridge.session.handleMessage(
        JSON.stringify({
          type: "sync_tools",
          tools: [{ name: "ping", description: "Ping" }],
        }),
        "a".repeat(32),
      );

      await notified;
      expect((await client.listTools()).tools.map((tool) => tool.name)).toEqual(["ping"]);
    } finally {
      await client.close();
      bridge.server.stop(true);
    }
  });
});
