/**
 * Types aligned with W3C WebMCP tool vocabulary.
 * @see https://github.com/webmachinelearning/webmcp
 */

export type JsonSchema = Record<string, unknown>;

export interface ToolAnnotations {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
}

export interface ContentBlock {
  type: "text" | "image";
  text?: string;
  data?: string;
  mimeType?: string;
}

export interface CallToolResult {
  content: ContentBlock[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

export type ToolExecuteCallback = (
  args: Record<string, unknown>,
) => CallToolResult | Promise<CallToolResult>;

export interface ToolDescriptor {
  name: string;
  title?: string;
  description: string;
  inputSchema?: JsonSchema;
  outputSchema?: JsonSchema;
  annotations?: ToolAnnotations;
  execute: ToolExecuteCallback;
}

export interface RegisterToolOptions {
  signal?: AbortSignal;
  exposedTo?: string[];
}

export interface RegisteredTool {
  name: string;
  title?: string;
  description: string;
  inputSchema?: JsonSchema;
  outputSchema?: JsonSchema;
  annotations?: ToolAnnotations;
}

export interface WebMCPPolyfillMarker {
  __isWebMCPPolyfill?: true;
}

export interface ModelContextTesting {
  listTools(): Array<{
    name: string;
    description: string;
    inputSchema?: string;
  }>;
  executeTool(
    toolName: string,
    inputArgsJson: string,
    options?: { signal?: AbortSignal },
  ): Promise<string | null>;
  registerToolsChangedCallback(callback: () => void): void;
  getCrossDocumentScriptToolResult(): Promise<string>;
}

export interface JourneyDefinition {
  name: string;
  description?: string;
  tools: string[];
  steps?: string[];
}

export interface JourneyRegistry {
  register(definition: JourneyDefinition): void;
  unregister(name: string): void;
  getActiveJourneys(): JourneyDefinition[];
  isToolExposed(toolName: string): boolean;
  setJourneyActive(name: string, active: boolean): void;
  addChangeListener(listener: () => void): () => void;
}

/** Wire protocol between page and @thegreataxios/webmcp-bridge */
export type BridgeClientMessage =
  | { type: "auth"; token: string }
  | { type: "sync_tools"; tools: BridgeToolSummary[] }
  | { type: "tool_result"; id: string; result: CallToolResult | { error: string } };

export type BridgeServerMessage =
  | { type: "auth_required" }
  | { type: "auth_ok" }
  | { type: "error"; message: string }
  | { type: "execute_tool"; id: string; name: string; args: Record<string, unknown> };

export interface BridgeToolSummary {
  name: string;
  description: string;
  inputSchema?: JsonSchema;
  title?: string;
  annotations?: ToolAnnotations;
}
