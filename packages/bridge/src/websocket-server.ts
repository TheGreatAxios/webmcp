import type { Server, ServerWebSocket } from "bun";
import type { BridgeSecurityOptions } from "./security";
import { DEFAULT_HOST, DEFAULT_PORT, generateBridgeToken, isOriginAllowed } from "./security";

export interface BridgeServerOptions extends BridgeSecurityOptions {
  onConnection?: (ws: ServerWebSocket<{ authenticated: boolean }>) => void;
  onClose?: () => void;
  onMessage?: (raw: string) => void;
}

export async function createBridgeWebSocketServer(options: BridgeServerOptions = {}) {
  const host = options.host ?? DEFAULT_HOST;
  const port = options.port ?? DEFAULT_PORT;
  const token = options.token ?? generateBridgeToken();

  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error("Bridge must bind to localhost only");
  }

  type WsData = { authenticated: boolean };

  const server: Server<WsData> = Bun.serve<WsData>({
    hostname: host,
    port,
    fetch(req, server) {
      const url = new URL(req.url);
      if (url.pathname !== "/ws") {
        return new Response("WebMCP Bridge — connect via WebSocket /ws", { status: 200 });
      }

      if (!isOriginAllowed(req.headers.get("origin"), options.allowedOrigins)) {
        return new Response("Forbidden origin", { status: 403 });
      }

      const upgraded = server.upgrade(req, { data: { authenticated: false } });
      if (!upgraded) return new Response("Expected WebSocket", { status: 400 });
      return undefined;
    },
    websocket: {
      open(ws) {
        options.onConnection?.(ws);
      },
      message(_ws, message) {
        const text = typeof message === "string" ? message : new TextDecoder().decode(message);
        options.onMessage?.(text);
      },
      close() {
        options.onClose?.();
      },
    },
  });

  return { server, token, host, port };
}

export { generateBridgeToken, resolveBridgeOptions, isOriginAllowed } from "./security";
