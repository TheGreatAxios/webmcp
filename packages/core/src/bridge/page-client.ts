import type { BridgeClientMessage, BridgeServerMessage, BridgeToolSummary } from "../types";
import { listBridgeToolSummariesAsync, executeToolForBridge } from "../polyfill";

export interface PageBridgeClientOptions {
  url: string;
  token: string;
  onStatusChange?: (status: PageBridgeStatus) => void;
}

export type PageBridgeStatus = "disconnected" | "connecting" | "connected" | "error";

/**
 * Connects the current page to a local webmcp-bridge WebSocket server.
 * Syncs exposed tools, executes tool calls, and propagates cancellation signals.
 */
export function createPageBridgeClient(options: PageBridgeClientOptions): {
  connect: () => void;
  disconnect: () => void;
  getStatus: () => PageBridgeStatus;
} {
  let ws: WebSocket | null = null;
  let status: PageBridgeStatus = "disconnected";
  let offToolsChange: (() => void) | null = null;
  const inflight = new Map<string, AbortController>();

  const setStatus = (next: PageBridgeStatus) => {
    status = next;
    options.onStatusChange?.(next);
  };

  const abortAllInflight = () => {
    for (const controller of inflight.values()) {
      controller.abort(new DOMException("Bridge disconnected", "AbortError"));
    }
    inflight.clear();
  };

  const syncTools = async () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const tools: BridgeToolSummary[] = await listBridgeToolSummariesAsync();
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const msg: BridgeClientMessage = { type: "sync_tools", tools };
    ws.send(JSON.stringify(msg));
  };

  const handleMessage = async (event: MessageEvent) => {
    const data = JSON.parse(String(event.data)) as BridgeServerMessage;

    if (data.type === "auth_required") {
      ws?.send(JSON.stringify({ type: "auth", token: options.token } satisfies BridgeClientMessage));
      return;
    }

    if (data.type === "auth_ok") {
      setStatus("connected");
      syncTools();
      return;
    }

    if (data.type === "error") {
      setStatus("error");
      return;
    }

    if (data.type === "cancel_tool") {
      const controller = inflight.get(data.id);
      if (controller) {
        inflight.delete(data.id);
        controller.abort(new DOMException("Cancelled by bridge", "AbortError"));
      }
      return;
    }

    if (data.type === "execute_tool") {
      const controller = new AbortController();
      inflight.set(data.id, controller);
      try {
        const raw = await executeToolForBridge(data.name, data.args, { signal: controller.signal });
        const result = typeof raw === "string" ? JSON.parse(raw) : raw;
        ws?.send(
          JSON.stringify({
            type: "tool_result",
            id: data.id,
            result,
          } satisfies BridgeClientMessage),
        );
      } catch (err) {
        ws?.send(
          JSON.stringify({
            type: "tool_result",
            id: data.id,
            result: { error: err instanceof Error ? err.message : String(err) },
          } satisfies BridgeClientMessage),
        );
      } finally {
        inflight.delete(data.id);
      }
    }
  };

  return {
    connect() {
      if (ws) return;
      setStatus("connecting");
      ws = new WebSocket(options.url);
      ws.addEventListener("open", () => {
        /* wait for auth_required */
      });
      ws.addEventListener("message", (e) => {
        handleMessage(e).catch(() => setStatus("error"));
      });
      ws.addEventListener("close", () => {
        abortAllInflight();
        setStatus("disconnected");
        ws = null;
        offToolsChange?.();
        offToolsChange = null;
      });
      ws.addEventListener("error", () => setStatus("error"));

      if (typeof document !== "undefined" && document.modelContext) {
        const onToolChange = () => syncTools();
        document.modelContext.addEventListener("toolchange", onToolChange);
        offToolsChange = () => document.modelContext?.removeEventListener("toolchange", onToolChange);
      }
    },
    disconnect() {
      abortAllInflight();
      offToolsChange?.();
      offToolsChange = null;
      ws?.close();
      ws = null;
      setStatus("disconnected");
    },
    getStatus: () => status,
  };
}
