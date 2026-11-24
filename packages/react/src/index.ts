/// <reference path="./jsx.d.ts" />
export { WebMCPProvider, WebMCPTool, useWebMCP, useWaitForToolsUntil } from "./provider";
export type { WebMCPContextValue, WebMCPProviderProps, WebMCPToolProps } from "./provider";

export {
  experimental_useWebMCPSync,
  type WebMCPSyncOptions,
  type WebMCPSyncResult,
  type WebMCPSyncTool,
} from "./experimental/sync";

export {
  experimental_WebMCPJourney,
  experimental_WebMCPJourney as ExperimentalWebMCPJourney,
  experimental_useWebMCPJourney,
  type ExperimentalWebMCPJourneyProps,
} from "./experimental/journey";

export {
  experimental_WebMCPConfirmProvider,
  experimental_WebMCPConfirmProvider as ExperimentalWebMCPConfirmProvider,
  experimental_useWebMCPConfirm,
  experimental_WebMCPGuardedTool,
  experimental_WebMCPGuardedTool as ExperimentalWebMCPGuardedTool,
  type GuardedToolProps,
  type PendingConfirmation,
} from "./experimental/confirm";

export {
  experimental_WebMCPBridgeProvider,
  experimental_WebMCPBridgeProvider as ExperimentalWebMCPBridgeProvider,
  experimental_useWebMCPBridgeStatus,
  type ExperimentalWebMCPBridgeProviderProps,
} from "./experimental/bridge";
