#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createBridgeWebSocketServer, resolveBridgeOptions } from "./index";

async function main() {
  const opts = resolveBridgeOptions();
  const { token, port, host } = await createBridgeWebSocketServer({
    ...opts,
    onToolList: async () => {
      // P1: proxy to connected browser tabs via WebSocket clients
      return [];
    },
    onToolCall: async (name, args) => {
      return { content: [{ type: "text", text: `Stub: ${name} ${JSON.stringify(args)}` }] };
    },
  });

  const mcp = new Server(
    { name: "webmcp-bridge", version: "0.0.0" },
    { capabilities: { tools: {} } },
  );

  mcp.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [] }));
  mcp.setRequestHandler(CallToolRequestSchema, async (request) => {
    return {
      content: [{ type: "text", text: JSON.stringify(request.params) }],
    };
  });

  // Token printed to stderr so MCP clients don't swallow it
  console.error(`[webmcp-bridge] WebSocket ws://${host}:${port}/ws token=${token}`);

  const transport = new StdioServerTransport();
  await mcp.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
