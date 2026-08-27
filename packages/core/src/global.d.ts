import type { ToolDescriptor } from "./types";

export interface ModelContext extends EventTarget {
  registerTool(
    tool: ToolDescriptor,
    options?: { signal?: AbortSignal; exposedTo?: string[] },
  ): Promise<undefined>;
  ontoolchange?: () => void;
}

declare global {
  interface Document {
    modelContext?: ModelContext;
  }
  interface Navigator {
    modelContextTesting?: import("./types").ModelContextTesting;
  }
}

export {};
