import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { BridgeServerMessage } from "./protocol";
import { PageSession } from "./session";
import {
  createBridgeWebSocketServer,
  type BridgeServerOptions,
  resolveBridgeOptions,
} from "./websocket-server";

export interface McpBridgeOptions extends BridgeServerOptions {
  appName?: string;
  appVersion?: string;
}

export async function createMcpBridge(options: McpBridgeOptions = {}) {
  const session = new PageSession();
  const wsOpts = resolveBridgeOptions();

  const { server, token, host, port } = await createBridgeWebSocketServer({
    ...wsOpts,
    ...options,
    onConnection: (ws) => {
      session.setSocket(ws);
      ws.send(JSON.stringify({ type: "auth_required" } satisfies BridgeServerMessage));
    },
    onClose: () => session.clearSocket(),
    onMessage: (raw) => session.handleMessage(raw, token),
  });

  const mcp = new Server(
    { name: options.appName ?? "webmcp-bridge", version: options.appVersion ?? "0.1.0" },
    { capabilities: { tools: {} } },
  );

  mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: session.getTools().map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema ?? { type: "object", properties: {} },
    })),
  }));

  mcp.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const result = await session.executeTool(name, (args ?? {}) as Record<string, unknown>);

    if (typeof result === "object" && result !== null && "content" in result) {
      const r = result as { content: Array<{ type: string; text?: string }>; isError?: boolean };
      return {
        content: r.content.map((c) => ({
          type: "text" as const,
          text: c.text ?? JSON.stringify(c),
        })),
        isError: r.isError,
      };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
    };
  });

  return {
    mcp,
    token,
    host,
    port,
    server,
    session,
    connectStdio: async () => {
      const transport = new StdioServerTransport();
      await mcp.connect(transport);
    },
  };
}
