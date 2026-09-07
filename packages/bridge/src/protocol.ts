export type { BridgeClientMessage, BridgeServerMessage, BridgeToolSummary } from "@thegreataxios/webmcp-core";
import type { BridgeClientMessage, BridgeServerMessage } from "@thegreataxios/webmcp-core";

export function parseClientMessage(raw: string): BridgeClientMessage {
  return JSON.parse(raw) as BridgeClientMessage;
}

export function parseServerMessage(raw: string): BridgeServerMessage {
  return JSON.parse(raw) as BridgeServerMessage;
}
