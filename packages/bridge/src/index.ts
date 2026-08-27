import type { BridgeSecurityOptions } from "./security";
import { DEFAULT_HOST, DEFAULT_PORT, generateBridgeToken, isOriginAllowed } from "./security";

export interface BridgeServerOptions extends BridgeSecurityOptions {
  onToolList?: () => Promise<Array<{ name: string; description: string; inputSchema?: unknown }>>;
  onToolCall?: (name: string, args: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Creates a localhost-only WebSocket server for page ↔ bridge communication.
 * Stable transport API (not experimental).
 */
export async function createBridgeWebSocketServer(options: BridgeServerOptions = {}) {
  const host = options.host ?? DEFAULT_HOST;
  const port = options.port ?? DEFAULT_PORT;
  const token = options.token ?? generateBridgeToken();

  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error("Bridge must bind to localhost only");
  }

  type WsData = { authenticated: boolean };

  const server = Bun.serve<WsData>({
    hostname: host,
    port,
    fetch(req, server) {
      const url = new URL(req.url);
      if (url.pathname !== "/ws") {
        return new Response("WebMCP Bridge", { status: 200 });
      }

      if (!isOriginAllowed(req.headers.get("origin"), options.allowedOrigins)) {
        return new Response("Forbidden origin", { status: 403 });
      }

      const upgrade = server.upgrade(req, { data: { authenticated: false } });
      if (!upgrade) return new Response("Expected WebSocket", { status: 400 });
      return undefined;
    },
    websocket: {
      open(ws) {
        ws.send(JSON.stringify({ type: "auth_required" }));
      },
      async message(ws, message) {
        const text = typeof message === "string" ? message : new TextDecoder().decode(message);
        const payload = JSON.parse(text) as {
          type: string;
          token?: string;
          name?: string;
          args?: Record<string, unknown>;
        };

        if (payload.type === "auth" && payload.token === token) {
          ws.data.authenticated = true;
          ws.send(JSON.stringify({ type: "auth_ok" }));
          return;
        }

        if (!ws.data.authenticated) {
          ws.send(JSON.stringify({ type: "error", message: "Unauthorized" }));
          ws.close(4401, "Unauthorized");
          return;
        }

        if (payload.type === "list_tools" && options.onToolList) {
          const tools = await options.onToolList();
          ws.send(JSON.stringify({ type: "tools", tools }));
          return;
        }

        if (payload.type === "call_tool" && payload.name && options.onToolCall) {
          const result = await options.onToolCall(payload.name, payload.args ?? {});
          ws.send(JSON.stringify({ type: "tool_result", result }));
        }
      },
    },
  });

  return { server, token, host, port };
}

export { generateBridgeToken, resolveBridgeOptions, isOriginAllowed } from "./security";
