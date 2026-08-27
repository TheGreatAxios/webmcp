import type { ModelContextTesting, ToolDescriptor, WebMCPPolyfillMarker } from "./types";
import { createToolRegistry, type ToolRegistry } from "./registry";

const POLYFILL_MARKER = "__isWebMCPPolyfill" as const;

let polyfillCount = 0;
let installedRegistry: ToolRegistry | null = null;

function createModelContext(registry: ToolRegistry): EventTarget & WebMCPPolyfillMarker {
  const target = new EventTarget() as EventTarget & WebMCPPolyfillMarker;
  target[POLYFILL_MARKER] = true;

  const modelContext = Object.assign(target, {
    async registerTool(
      tool: ToolDescriptor,
      options?: { signal?: AbortSignal; exposedTo?: string[] },
    ): Promise<undefined> {
      await registry.register(tool, options);
      target.dispatchEvent(new Event("toolchange"));
      return undefined;
    },
  });

  return modelContext;
}

function createTestingShim(registry: ToolRegistry): ModelContextTesting {
  let offChange: (() => void) | null = null;
  return {
    listTools() {
      return registry.listTools().map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema ? JSON.stringify(t.inputSchema) : undefined,
      }));
    },
    async executeTool(toolName, inputArgsJson, options) {
      const tool = registry.getTool(toolName);
      if (!tool) {
        throw new DOMException(`Tool "${toolName}" not found`, "NotFoundError");
      }
      if (options?.signal?.aborted) {
        throw new DOMException("Tool execution was aborted", "AbortError");
      }
      const parsed = JSON.parse(inputArgsJson) as Record<string, unknown>;
      const result = await tool.execute(parsed);
      return JSON.stringify(result);
    },
    registerToolsChangedCallback(callback) {
      offChange?.();
      offChange = registry.addChangeListener(callback);
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
