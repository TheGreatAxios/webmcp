import type { WebMCP } from "@w3c/webmcp-polyfill";
import type {
  ExecuteToolOptions,
  GetToolsOptions,
  ModelContextTesting,
  RegisterToolOptions,
  ToolDescriptor,
  ToolSnapshot,
} from "./types";

export interface ModelContext extends EventTarget {
  registerTool(tool: ToolDescriptor, options?: RegisterToolOptions): Promise<void>;
  getTools(options?: GetToolsOptions): Promise<ToolSnapshot[]>;
  executeTool(
    tool: ToolSnapshot,
    inputObject?: object,
    options?: ExecuteToolOptions,
  ): Promise<string>;
  waitForToolsUntil?(promise: Promise<unknown>): void;
  ontoolchange?: ((this: ModelContext, ev: Event) => unknown) | null;
  ontoolactivated?: ((this: ModelContext, ev: ToolActivatedEvent) => unknown) | null;
  ontoolcancel?: ((this: ModelContext, ev: ToolCancelEvent) => unknown) | null;
}

declare global {
  namespace WebMCP {
    interface ModelContext {
      waitForToolsUntil?(promise: Promise<unknown>): void;
    }
  }
  interface Navigator {
    modelContextTesting?: ModelContextTesting;
  }
}

export {};
