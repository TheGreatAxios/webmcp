import { installWebMCP } from "@w3c/webmcp-polyfill";
import type {
  BridgeToolSummary,
  ExecuteToolOptions,
  GetToolsOptions,
  JourneyRegistry,
  ModelContextTesting,
  RegisterToolOptions,
  ToolDescriptor,
  ToolSnapshot,
  WebMCPPolyfillMarker,
} from "./types";
import { createToolRegistry, type ToolRegistry } from "./registry";
import { parseToolArgsJson } from "./validation";

const POLYFILL_MARKER = "__isWebMCPPolyfill" as const;

let polyfillCount = 0;
let installedRegistry: ToolRegistry | null = null;
let journeyRegistry: JourneyRegistry | null = null;
let usedW3cPolyfill = false;

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

function serializeResult(value: unknown): string {
  try {
    const serialized = JSON.stringify(value ?? null);
    if (serialized === undefined) {
      throw new DOMException("Tool result is not JSON-serializable", "OperationError");
    }
    return serialized;
  } catch (err) {
    if (err instanceof DOMException) throw err;
    throw new DOMException("Tool result is not JSON-serializable", "OperationError");
  }
}

function createFallbackModelContext(registry: ToolRegistry): EventTarget & WebMCPPolyfillMarker {
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
    async registerTool(tool: ToolDescriptor, options?: RegisterToolOptions): Promise<void> {
      await registry.register(tool, options);
      scheduleToolChange();
    },

    async getTools(_options?: GetToolsOptions): Promise<ToolSnapshot[]> {
      return registry.listToolSnapshots().filter((snap) => {
        if (!journeyRegistry) return true;
        return journeyRegistry.isToolExposed(snap.name);
      });
    },

    async executeTool(
      tool: ToolSnapshot,
      inputObject: object = {},
      options?: ExecuteToolOptions,
    ): Promise<string> {
      const reg = registry.getRegistrationBySnapshot(tool);
      if (!reg) {
        throw new DOMException(`Tool "${tool.name}" is no longer registered`, "NotFoundError");
      }
      if (journeyRegistry && !journeyRegistry.isToolExposed(reg.descriptor.name)) {
        throw new DOMException(
          `Tool "${reg.descriptor.name}" is not exposed in the active journey`,
          "NotFoundError",
        );
      }
      if (options?.signal?.aborted) {
        throw options.signal.reason ?? new DOMException("Tool execution was aborted", "AbortError");
      }

      const controller = new AbortController();
      const onCallerAbort = () => controller.abort(options?.signal?.reason);
      options?.signal?.addEventListener("abort", onCallerAbort, { once: true });

      try {
        const result = await reg.descriptor.execute(
          inputObject as Record<string, unknown>,
          { signal: controller.signal },
        );
        return serializeResult(result);
      } catch (err) {
        if (err instanceof DOMException) throw err;
        throw new DOMException(
          err instanceof Error ? err.message : String(err),
          "OperationError",
        );
      } finally {
        options?.signal?.removeEventListener("abort", onCallerAbort);
      }
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
        throw new DOMException(
          `Tool "${toolName}" is not exposed in the active journey`,
          "NotFoundError",
        );
      }
      const tool = registry.getTool(toolName);
      if (!tool) {
        throw new DOMException(`Tool "${toolName}" not found`, "NotFoundError");
      }
      if (options?.signal?.aborted) {
        throw new DOMException("Tool execution was aborted", "AbortError");
      }
      const parsed = parseToolArgsJson(inputArgsJson);
      const controller = new AbortController();
      const onAbort = () => controller.abort(options?.signal?.reason);
      options?.signal?.addEventListener("abort", onAbort, { once: true });
      try {
        const result = await tool.execute(parsed, { signal: controller.signal });
        return serializeResult(result);
      } finally {
        options?.signal?.removeEventListener("abort", onAbort);
      }
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
  if (usedW3cPolyfill) return false;
  const mc = document.modelContext as WebMCPPolyfillMarker | undefined;
  return mc != null && mc[POLYFILL_MARKER] !== true;
}

export function installPolyfill(): boolean {
  if (typeof document === "undefined") return false;
  if (isNativeModelContext()) return false;

  polyfillCount++;
  if (polyfillCount > 1) return true;

  installedRegistry = createToolRegistry();

  // Prefer the official @w3c/webmcp-polyfill in real secure browser contexts when
  // no modelContext exists yet; fall back to our spec-aligned implementation in
  // non-secure / test DOM environments.
  if (globalThis.isSecureContext && !("modelContext" in document)) {
    try {
      installWebMCP();
      if ("modelContext" in document && document.modelContext) {
        usedW3cPolyfill = true;
      }
    } catch {
      usedW3cPolyfill = false;
    }
  }

  if (!usedW3cPolyfill) {
    const modelContext = createFallbackModelContext(installedRegistry);
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      enumerable: true,
      value: modelContext,
    });
  }

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
  if (!usedW3cPolyfill) {
    Reflect.deleteProperty(document, "modelContext");
  }
  usedW3cPolyfill = false;
  Reflect.deleteProperty(navigator, "modelContextTesting");
}

export function getRegistry(): ToolRegistry | null {
  return installedRegistry;
}

export function listBridgeToolSummaries(): BridgeToolSummary[] {
  if (!installedRegistry) return [];
  return filterExposedTools(installedRegistry);
}

export async function executeToolForBridge(
  name: string,
  args: Record<string, unknown>,
  options?: ExecuteToolOptions,
): Promise<unknown> {
  if (typeof document !== "undefined" && document.modelContext?.getTools) {
    const tools = await document.modelContext.getTools();
    const match = tools.find((t) => t.name === name);
    if (match && document.modelContext.executeTool) {
      return document.modelContext.executeTool(match, args, options);
    }
  }
  const testing = navigator.modelContextTesting;
  if (!testing) {
    throw new Error("modelContextTesting is not available");
  }
  return testing.executeTool(name, JSON.stringify(args), options);
}
