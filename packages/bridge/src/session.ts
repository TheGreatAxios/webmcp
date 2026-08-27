import type { ServerWebSocket } from "bun";
import type { BridgeClientMessage, BridgeServerMessage, BridgeToolSummary } from "./protocol";

type WsData = { authenticated: boolean };

export class PageSession {
  #ws: ServerWebSocket<WsData> | null = null;
  #tools: BridgeToolSummary[] = [];
  #pending = new Map<
    string,
    { resolve: (value: unknown) => void; reject: (err: Error) => void }
  >();

  setSocket(ws: ServerWebSocket<WsData>) {
    this.#ws = ws;
  }

  clearSocket() {
    this.#ws = null;
    for (const [, pending] of this.#pending) {
      pending.reject(new Error("Page disconnected"));
    }
    this.#pending.clear();
  }

  isConnected(): boolean {
    return this.#ws != null && this.#ws.readyState === WebSocket.OPEN;
  }

  getTools(): BridgeToolSummary[] {
    return this.#tools;
  }

  handleMessage(raw: string, token: string): void {
    const ws = this.#ws;
    if (!ws) return;

    const msg = JSON.parse(raw) as BridgeClientMessage;

    if (msg.type === "auth") {
      if (msg.token !== token) {
        ws.send(JSON.stringify({ type: "error", message: "Invalid token" } satisfies BridgeServerMessage));
        ws.close(4401, "Unauthorized");
        return;
      }
      ws.data.authenticated = true;
      ws.send(JSON.stringify({ type: "auth_ok" } satisfies BridgeServerMessage));
      return;
    }

    if (!ws.data.authenticated) {
      ws.send(JSON.stringify({ type: "error", message: "Unauthorized" } satisfies BridgeServerMessage));
      ws.close(4401, "Unauthorized");
      return;
    }

    if (msg.type === "sync_tools") {
      this.#tools = msg.tools;
      return;
    }

    if (msg.type === "tool_result") {
      const pending = this.#pending.get(msg.id);
      if (!pending) return;
      this.#pending.delete(msg.id);
      if ("error" in msg.result && typeof msg.result.error === "string") {
        pending.reject(new Error(msg.result.error));
      } else {
        pending.resolve(msg.result);
      }
    }
  }

  executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const ws = this.#ws;
    if (!ws || !ws.data.authenticated) {
      throw new Error("No page connected");
    }

    const id = crypto.randomUUID();
    const msg: BridgeServerMessage = { type: "execute_tool", id, name, args };
    ws.send(JSON.stringify(msg));

    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
    });
  }
}
