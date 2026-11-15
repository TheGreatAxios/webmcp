/// <reference path="./jsx.d.ts" />
export { WebMCPProvider, WebMCPTool, useWebMCP } from "./provider";
export type { WebMCPContextValue, WebMCPProviderProps, WebMCPToolProps } from "./provider";

export {
  experimental_useWebMCPSync,
  type WebMCPSyncOptions,
  type WebMCPSyncResult,
  type WebMCPSyncTool,
} from "./experimental/sync";

export {
  experimental_WebMCPJourney,
  experimental_useWebMCPJourney,
  type ExperimentalWebMCPJourneyProps,
} from "./experimental/journey";

export {
  experimental_WebMCPConfirmProvider,
  experimental_useWebMCPConfirm,
  experimental_WebMCPGuardedTool,
  type GuardedToolProps,
  type PendingConfirmation,
} from "./experimental/confirm";

export {
  experimental_WebMCPBridgeProvider,
  experimental_useWebMCPBridgeStatus,
  type ExperimentalWebMCPBridgeProviderProps,
} from "./experimental/bridge";

import { experimental_WebMCPJourney } from "./experimental/journey";
import {
  experimental_WebMCPConfirmProvider,
  experimental_WebMCPGuardedTool,
} from "./experimental/confirm";
import { experimental_WebMCPBridgeProvider } from "./experimental/bridge";

/**
 * PascalCase aliases for JSX.
 *
 * React treats lowercase-initial tags as HTML intrinsics, so
 * `<experimental_WebMCPJourney />` is invalid. Prefer these in JSX.
 */
export const ExperimentalWebMCPJourney = experimental_WebMCPJourney;
export const ExperimentalWebMCPConfirmProvider = experimental_WebMCPConfirmProvider;
export const ExperimentalWebMCPGuardedTool = experimental_WebMCPGuardedTool;
export const ExperimentalWebMCPBridgeProvider = experimental_WebMCPBridgeProvider;
