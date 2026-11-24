import { getContext, onDestroy, setContext } from "svelte";
import { writable, type Readable } from "svelte/store";
import {
  cleanupPolyfill,
  createPageBridgeClient,
  experimental_createJourneyRegistry,
  installPolyfill,
  isNativeModelContext,
  setJourneyRegistry,
  type JourneyRegistry,
  type JsonSchema,
  type PageBridgeStatus,
  type ToolAnnotations,
  type ToolExecuteCallback,
  type ToolExecuteCallbackOptions,
} from "@thegreataxios/webmcp-core";

const WEBMCP_CONTEXT_KEY = Symbol("webmcp-svelte-context");

export interface WebMCPSvelteContext {
  readonly available: boolean;
  readonly native: boolean;
  readonly appName: string;
  readonly appVersion?: string;
  readonly journeyRegistry: JourneyRegistry;
  destroy(): void;
}

export interface CreateWebMCPProviderOptions {
  name: string;
  version?: string;
}

function tryOnDestroy(fn: () => void): void {
  try {
    onDestroy(fn);
  } catch {
    // Called outside a Svelte component initialization lifecycle (e.g. unit tests).
  }
}

function trySetContext<T>(key: symbol, value: T): void {
  try {
    setContext(key, value);
  } catch {
    // Outside component init.
  }
}

function tryGetContext<T>(key: symbol): T | undefined {
  try {
    return getContext<T>(key);
  } catch {
    return undefined;
  }
}

/**
 * Initialize WebMCP in a Svelte root component (or standalone store) and register cleanup on destroy.
 */
export function createWebMCPProvider(options: CreateWebMCPProviderOptions): WebMCPSvelteContext {
  const journeyRegistry = experimental_createJourneyRegistry();
  setJourneyRegistry(journeyRegistry);
  installPolyfill();

  let destroyed = false;
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    setJourneyRegistry(null);
    cleanupPolyfill();
  };

  const ctx: WebMCPSvelteContext = {
    available: typeof document !== "undefined" && document.modelContext != null,
    native: isNativeModelContext(),
    appName: options.name,
    appVersion: options.version,
    journeyRegistry,
    destroy,
  };

  trySetContext(WEBMCP_CONTEXT_KEY, ctx);
  tryOnDestroy(destroy);

  return ctx;
}

export function getWebMCP(): WebMCPSvelteContext | undefined {
  return tryGetContext<WebMCPSvelteContext>(WEBMCP_CONTEXT_KEY);
}

export interface SvelteToolOptions {
  name: string;
  description: string;
  title?: string;
  inputSchema?: JsonSchema;
  outputSchema?: JsonSchema;
  annotations?: ToolAnnotations;
  exposedTo?: string[];
  handler: ToolExecuteCallback;
}

/**
 * Register a WebMCP tool for the lifetime of the current Svelte component (or until `dispose()` is called).
 */
export function useWebMCPTool(options: SvelteToolOptions): { dispose: () => void } {
  const controller = new AbortController();
  let disposed = false;

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    controller.abort();
  };

  if (typeof document !== "undefined" && document.modelContext) {
    document.modelContext
      .registerTool(
        {
          name: options.name,
          title: options.title,
          description: options.description,
          inputSchema: options.inputSchema,
          outputSchema: options.outputSchema,
          annotations: options.annotations,
          execute: options.handler,
        },
        { signal: controller.signal, exposedTo: options.exposedTo },
      )
      .catch(() => {});
  }

  tryOnDestroy(dispose);
  return { dispose };
}

/**
 * Signal async tool registration stability to `document.modelContext.waitForToolsUntil`.
 */
export function useWaitForToolsUntil(promise: Promise<unknown>): void {
  if (typeof document !== "undefined") {
    document.modelContext?.waitForToolsUntil?.(promise);
  }
}

export interface SvelteSyncTool<TState> {
  description: string;
  title?: string;
  inputSchema?: JsonSchema;
  outputSchema?: JsonSchema;
  annotations?: ToolAnnotations;
  reducer: (
    state: TState,
    args: Record<string, unknown>,
    options?: ToolExecuteCallbackOptions,
  ) => TState | Promise<TState>;
}

/**
 * Bind a Svelte writable store to one or more WebMCP tools whose reducers update reactive state.
 */
export function experimental_useWebMCPSync<TState>(options: {
  initial: TState;
  tools: Record<string, SvelteSyncTool<TState>>;
}): {
  state: Readable<TState>;
  set: (next: TState) => void;
  update: (fn: (prev: TState) => TState) => void;
  dispose: () => void;
} {
  let current = options.initial;
  const store = writable<TState>(current);
  let queue: Promise<void> = Promise.resolve();

  const set = (next: TState) => {
    current = next;
    store.set(next);
  };

  const update = (fn: (prev: TState) => TState) => {
    set(fn(current));
  };

  const handles = Object.entries(options.tools).map(([name, def]) =>
    useWebMCPTool({
      name,
      title: def.title,
      description: def.description,
      inputSchema: def.inputSchema,
      outputSchema: def.outputSchema,
      annotations: def.annotations,
      handler: (args, cbOptions) => {
        const run = queue.then(async () => {
          const next = await def.reducer(current, args, cbOptions);
          set(next);
          return next;
        });
        queue = run.then(
          () => undefined,
          () => undefined,
        );
        return run;
      },
    }),
  );

  const dispose = () => {
    for (const h of handles) h.dispose();
  };
  tryOnDestroy(dispose);

  return {
    state: { subscribe: store.subscribe },
    set,
    update,
    dispose,
  };
}

/**
 * Register and control a journey from Svelte, auto-cleaning up on destroy.
 */
export function experimental_useWebMCPJourney(options: {
  name: string;
  tools: string[];
  description?: string;
  active?: boolean;
  registry?: JourneyRegistry;
}): {
  setActive: (active: boolean) => void;
  dispose: () => void;
} {
  const registry = options.registry ?? getWebMCP()?.journeyRegistry;
  registry?.register({
    name: options.name,
    description: options.description,
    tools: options.tools,
  });
  if (options.active) {
    registry?.setJourneyActive(options.name, true);
  }

  const dispose = () => {
    registry?.unregister(options.name);
  };
  tryOnDestroy(dispose);

  return {
    setActive: (active: boolean) => registry?.setJourneyActive(options.name, active),
    dispose,
  };
}

/**
 * Connect a Svelte app to `webmcp-bridge` and expose reactive connection status.
 */
export function experimental_useWebMCPBridge(options: {
  url?: string;
  token: string;
}): {
  status: Readable<PageBridgeStatus>;
  disconnect: () => void;
} {
  const statusStore = writable<PageBridgeStatus>("disconnected");
  const client = createPageBridgeClient({
    url: options.url ?? "ws://127.0.0.1:17321/ws",
    token: options.token,
    onStatusChange: (next) => statusStore.set(next),
  });
  client.connect();

  const disconnect = () => client.disconnect();
  tryOnDestroy(disconnect);

  return {
    status: { subscribe: statusStore.subscribe },
    disconnect,
  };
}
