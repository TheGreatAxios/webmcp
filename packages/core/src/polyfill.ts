import { installWebMCP } from "@w3c/webmcp-polyfill";
import {
  createToolActivatedEvent,
  createToolCancelEvent,
  ensureEventConstructors,
} from "./events";
import {
  experimental_createContinuationManager,
  type ContinuationManager,
} from "./experimental/continuations";
import { isToolVisibleToCaller } from "./origin-policy";
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
let w3cPolyfillInstalled = false;
const stabilityPromises = new Set<Promise<unknown>>();
const continuationManager: ContinuationManager = experimental_createContinuationManager();

export function experimental_getContinuationManager(): ContinuationManager {
  return continuationManager;
}

export function awaitToolsStable(): Promise<void> {
  if (stabilityPromises.size === 0) return Promise.resolve();
  return Promise.allSettled(Array.from(stabilityPromises)).then(() => {
    if (stabilityPromises.size > 0) return awaitToolsStable();
  });
}

function trackStabilityPromise(promise: Promise<unknown>): void {
  const wrapped = Promise.resolve(promise).finally(() => {
    stabilityPromises.delete(wrapped);
  });
  stabilityPromises.add(wrapped);
}

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
  ensureEventConstructors();
  const target = new EventTarget() as EventTarget &
    WebMCPPolyfillMarker & {
      ontoolchange: ((ev: Event) => unknown) | null;
      ontoolactivated: ((ev: Event) => unknown) | null;
      ontoolcancel: ((ev: Event) => unknown) | null;
    };
  target[POLYFILL_MARKER] = true;
  target.ontoolchange = null;
  target.ontoolactivated = null;
  target.ontoolcancel = null;

  const dispatchWithHandler = (
    event: Event,
    handlerName: "ontoolchange" | "ontoolactivated" | "ontoolcancel",
  ) => {
    target.dispatchEvent(event);
    const handler = target[handlerName];
    if (typeof handler === "function") {
      handler.call(target, event);
    }
  };

  let changeScheduled = false;
  const scheduleToolChange = () => {
    if (changeScheduled) return;
    changeScheduled = true;
    queueMicrotask(() => {
      changeScheduled = false;
      dispatchWithHandler(new Event("toolchange"), "ontoolchange");
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

    waitForToolsUntil(promise: Promise<unknown>): void {
      trackStabilityPromise(promise);
    },

    async getTools(options?: GetToolsOptions): Promise<ToolSnapshot[]> {
      const callerOrigin =
        typeof globalThis.location?.origin === "string" ? globalThis.location.origin : "null";
      return registry.listToolSnapshots().filter((snap) => {
        if (journeyRegistry && !journeyRegistry.isToolExposed(snap.name)) return false;
        const reg = registry.getRegistration(snap.name);
        return isToolVisibleToCaller(
          callerOrigin,
          snap.origin,
          reg?.exposedTo ?? [],
          options?.fromOrigins,
        );
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
      const onCallerAbort = () => {
        controller.abort(options?.signal?.reason);
        dispatchWithHandler(createToolCancelEvent(reg.descriptor.name), "ontoolcancel");
      };
      options?.signal?.addEventListener("abort", onCallerAbort, { once: true });

      const invocationHandle = continuationManager.createInvocation(controller.signal);
      try {
        const execPromise = Promise.resolve(
          reg.descriptor.execute(inputObject as Record<string, unknown>, {
            signal: controller.signal,
            invocation: invocationHandle.invocation,
          }),
        );
        // Per W3C WebMCP PR #371: fire `toolactivated` after invoking execute.
        dispatchWithHandler(createToolActivatedEvent(reg.descriptor.name), "ontoolactivated");

        const result = await execPromise;
        if (options?.signal?.aborted) {
          throw options.signal.reason ?? new DOMException("Tool execution was aborted", "AbortError");
        }
        return serializeResult(result);
      } catch (err) {
        if (err instanceof DOMException) throw err;
        throw new DOMException(
          err instanceof Error ? err.message : String(err),
          "OperationError",
        );
      } finally {
        invocationHandle.settle();
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
      if (options?.signal?.aborted) {
        throw new DOMException("Tool execution was aborted", "AbortError");
      }
      const parsed = parseToolArgsJson(inputArgsJson);
      if (usedW3cPolyfill && typeof document !== "undefined" && document.modelContext?.getTools) {
        const tools = await document.modelContext.getTools();
        const match = tools.find((t) => t.name === toolName);
        if (!match) {
          throw new DOMException(`Tool "${toolName}" not found`, "NotFoundError");
        }
        return document.modelContext.executeTool(match, parsed, options);
      }
      const tool = registry.getTool(toolName);
      if (!tool) {
        throw new DOMException(`Tool "${toolName}" not found`, "NotFoundError");
      }
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
      const onToolChange = () => callback();
      if (usedW3cPolyfill && typeof document !== "undefined" && document.modelContext) {
        document.modelContext.addEventListener("toolchange", onToolChange);
      }
      offChange = () => {
        offRegistry();
        offJourney?.();
        if (usedW3cPolyfill && typeof document !== "undefined" && document.modelContext) {
          document.modelContext.removeEventListener("toolchange", onToolChange);
        }
      };
    },
    getCrossDocumentScriptToolResult() {
      return Promise.resolve("[]");
    },
  };
}

export function isNativeModelContext(): boolean {
  if (typeof document === "undefined") return false;
  if (usedW3cPolyfill || w3cPolyfillInstalled) return false;
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
  if (globalThis.isSecureContext && (!("modelContext" in document) || w3cPolyfillInstalled)) {
    try {
      if (!w3cPolyfillInstalled) {
        installWebMCP();
      }
      if ("modelContext" in document && document.modelContext) {
        usedW3cPolyfill = true;
        w3cPolyfillInstalled = true;
        const mc = document.modelContext;
        if (typeof mc.waitForToolsUntil !== "function") {
          Object.defineProperty(mc, "waitForToolsUntil", {
            configurable: true,
            value: trackStabilityPromise,
          });
        }
        // Mirror registerTool metadata into installedRegistry so synchronous
        // navigator.modelContextTesting.listTools() and listBridgeToolSummaries()
        // stay in sync with @w3c/webmcp-polyfill.
        const origRegisterTool = mc.registerTool.bind(mc);
        const registry = installedRegistry;
        Object.defineProperty(mc, "registerTool", {
          configurable: true,
          value: async (tool: ToolDescriptor, options?: RegisterToolOptions) => {
            await origRegisterTool(tool as never, options);
            await registry.register(tool, options).catch(() => {});
          },
        });
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

/**
 * Async bridge tool listing that works across native `document.modelContext`,
 * `@w3c/webmcp-polyfill`, and the fallback registry.
 */
export async function listBridgeToolSummariesAsync(): Promise<BridgeToolSummary[]> {
  if (typeof document !== "undefined" && document.modelContext?.getTools) {
    const tools = await document.modelContext.getTools();
    return tools
      .filter((t) => (!journeyRegistry ? true : journeyRegistry.isToolExposed(t.name)))
      .map((t) => ({
        name: t.name,
        title: t.title || undefined,
        description: t.description,
        inputSchema: (t.inputSchema ?? undefined) as BridgeToolSummary["inputSchema"],
        outputSchema: (t.outputSchema ?? undefined) as BridgeToolSummary["outputSchema"],
        annotations: t.annotations ?? undefined,
      }));
  }
  return listBridgeToolSummaries();
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
