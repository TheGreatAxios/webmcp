import type {
  BridgeClientMessage,
  BridgeServerMessage,
  BridgeToolSummary,
  JourneyRegistry,
  ModelContextTesting,
  ToolDescriptor,
  WebMCPPolyfillMarker,
} from "./types";
import { createToolRegistry, type ToolRegistry } from "./registry";
import { parseToolArgsJson } from "./validation";

const POLYFILL_MARKER = "__isWebMCPPolyfill" as const;

let polyfillCount = 0;
let installedRegistry: ToolRegistry | null = null;
let journeyRegistry: JourneyRegistry | null = null;

export function setJourneyRegistry(registry: JourneyRegistry | null): void {
  journeyRegistry = registry;
}

export function getJourneyRegistry(): JourneyRegistry | null {
  return journeyRegistry;
}

function filterExposedTools(registry: ToolRegistry): BridgeToolSummary[] {
  return registry.listTools().filter((tool) => {
    if (!journeyRegistry) return true;
    return journeyRegistry.isToolExposed(tool.name);
  });
}

function createModelContext(registry: ToolRegistry): EventTarget & WebMCPPolyfillMarker {
  const target = new EventTarget() as EventTarget & WebMCPPolyfillMarker;
  target[POLYFILL_MARKER] = true;

  let changeScheduled = false;
  const scheduleToolChange = () => {
    if (changeScheduled) return;
    changeScheduled = true;
    queueMicrotask(() => {
      changeScheduled = false;
      target.dispatchEvent(new Event("toolchange"));
    });
  };

  registry.addChangeListener(scheduleToolChange);
  if (journeyRegistry) {
    journeyRegistry.addChangeListener(scheduleToolChange);
  }

  const modelContext = Object.assign(target, {
    async registerTool(
      tool: ToolDescriptor,
      options?: { signal?: AbortSignal; exposedTo?: string[] },
    ): Promise<undefined> {
      await registry.register(tool, options);
      scheduleToolChange();
      return undefined;
    },
  });

  return modelContext;
}

function createTestingShim(registry: ToolRegistry): ModelContextTesting {
  let offChange: (() => void) | null = null;

  return {
    listTools() {
      return filterExposedTools(registry).map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema ? JSON.stringify(t.inputSchema) : undefined,
      }));
    },
    async executeTool(toolName, inputArgsJson, options) {
      if (journeyRegistry && !journeyRegistry.isToolExposed(toolName)) {
        throw new DOMException(`Tool "${toolName}" is not exposed in the active journey`, "NotFoundError");
      }
      const tool = registry.getTool(toolName);
      if (!tool) {
        throw new DOMException(`Tool "${toolName}" not found`, "NotFoundError");
      }
      if (options?.signal?.aborted) {
        throw new DOMException("Tool execution was aborted", "AbortError");
      }
      const parsed = parseToolArgsJson(inputArgsJson);
      const result = await tool.execute(parsed);
      return JSON.stringify(result);
    },
    registerToolsChangedCallback(callback) {
      offChange?.();
      const offRegistry = registry.addChangeListener(callback);
      const offJourney = journeyRegistry?.addChangeListener(callback);
      offChange = () => {
        offRegistry();
        offJourney?.();
      };
    },
    getCrossDocumentScriptToolResult() {
      return Promise.resolve("[]");
    },
  };
}

export function isNativeModelContext(): boolean {
  if (typeof document === "undefined") return false;
  const mc = document.modelContext as WebMCPPolyfillMarker | undefined;
  return mc != null && mc[POLYFILL_MARKER] !== true;
}

export function installPolyfill(): boolean {
  if (typeof document === "undefined") return false;
  if (isNativeModelContext()) return false;

  polyfillCount++;
  if (polyfillCount > 1) return true;

  installedRegistry = createToolRegistry();
  const modelContext = createModelContext(installedRegistry);

  Object.defineProperty(document, "modelContext", {
    configurable: true,
    enumerable: true,
    value: modelContext,
  });

  Object.defineProperty(navigator, "modelContextTesting", {
    configurable: true,
    enumerable: true,
    value: createTestingShim(installedRegistry),
  });

  return true;
}

export function cleanupPolyfill(): void {
  if (typeof document === "undefined") return;
  if (isNativeModelContext()) return;

  polyfillCount = Math.max(0, polyfillCount - 1);
  if (polyfillCount > 0) return;

  installedRegistry = null;
  Reflect.deleteProperty(document, "modelContext");
  Reflect.deleteProperty(navigator, "modelContextTesting");
}

export function getRegistry(): ToolRegistry | null {
  return installedRegistry;
}

export function listBridgeToolSummaries(): BridgeToolSummary[] {
  if (!installedRegistry) return [];
  return filterExposedTools(installedRegistry);
}

export function executeToolForBridge(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const testing = navigator.modelContextTesting;
  if (!testing) {
    throw new Error("modelContextTesting is not available");
  }
  return testing.executeTool(name, JSON.stringify(args));
}

export type { BridgeClientMessage, BridgeServerMessage };
