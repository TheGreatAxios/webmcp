import type { CallToolResult, JsonSchema, ToolAnnotations } from "@thegreataxios/webmcp-core";

export interface BridgeToolSummary {
  name: string;
  description: string;
  title?: string;
  inputSchema?: JsonSchema;
  annotations?: ToolAnnotations;
}

export type BridgeClientMessage =
  | { type: "auth"; token: string }
  | { type: "sync_tools"; tools: BridgeToolSummary[] }
  | { type: "tool_result"; id: string; result: CallToolResult | { error: string } };

export type BridgeServerMessage =
  | { type: "auth_required" }
  | { type: "auth_ok" }
  | { type: "error"; message: string }
  | { type: "execute_tool"; id: string; name: string; args: Record<string, unknown> };

export function parseClientMessage(raw: string): BridgeClientMessage {
  return JSON.parse(raw) as BridgeClientMessage;
}

export function parseServerMessage(raw: string): BridgeServerMessage {
  return JSON.parse(raw) as BridgeServerMessage;
}
