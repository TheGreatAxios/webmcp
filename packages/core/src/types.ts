/**
 * Minimal types aligned with W3C WebMCP / MCP tool vocabulary.
 * Replace with `webmcp-types` when publishing if desired.
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
  origin?: string;
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
  /** Tool names exposed while this journey is active */
  tools: string[];
  /** Optional ordered hints for agents (not enforced by browser) */
  steps?: string[];
}

export interface JourneyRegistry {
  register(definition: JourneyDefinition): void;
  unregister(name: string): void;
  getActiveJourneys(): JourneyDefinition[];
  isToolExposed(toolName: string): boolean;
  setJourneyActive(name: string, active: boolean): void;
}
