export type { ModelContext } from "./global";

export type {
  BridgeClientMessage,
  BridgeServerMessage,
  BridgeToolSummary,
  CallToolResult,
  ContentBlock,
  JourneyDefinition,
  JourneyRegistry,
  JsonSchema,
  ModelContextTesting,
  RegisteredTool,
  RegisterToolOptions,
  ToolAnnotations,
  ToolDescriptor,
  ToolExecuteCallback,
} from "./types";

export { createToolRegistry, type ToolRegistry } from "./registry";
export {
  cleanupPolyfill,
  executeToolForBridge,
  getJourneyRegistry,
  getRegistry,
  installPolyfill,
  isNativeModelContext,
  listBridgeToolSummaries,
  setJourneyRegistry,
} from "./polyfill";

export { createPageBridgeClient, type PageBridgeClientOptions, type PageBridgeStatus } from "./bridge/page-client";

export {
  registerWebMCPElements,
  WEBMCP_TAGS,
  WebMCPJourneyElement,
  WebMCPProviderElement,
} from "./elements";

export {
  experimental_createJourneyRegistry,
  experimental_defineJourney,
} from "./experimental/journey";

export {
  assertToolName,
  parseToolArgsJson,
  validateToolDescriptor,
} from "./validation";
