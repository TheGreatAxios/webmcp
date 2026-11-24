import {
  getCurrentInstance,
  getCurrentScope,
  inject,
  onScopeDispose,
  provide,
  readonly,
  ref,
  type App,
  type InjectionKey,
  type Plugin,
  type Ref,
} from "vue";
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

export interface WebMCPVueContext {
  readonly available: boolean;
  readonly native: boolean;
  readonly appName: string;
  readonly appVersion?: string;
  readonly journeyRegistry: JourneyRegistry;
  destroy(): void;
}

export const WEBMCP_INJECTION_KEY: InjectionKey<WebMCPVueContext> = Symbol("webmcp-vue-context");

export interface ProvideWebMCPOptions {
  name: string;
  version?: string;
}

function registerScopeCleanup(fn: () => void): void {
  if (getCurrentScope()) {
    onScopeDispose(fn);
  }
}

/**
 * Initialize WebMCP inside a Vue component `setup()` or `effectScope()`.
 */
export function provideWebMCP(options: ProvideWebMCPOptions): WebMCPVueContext {
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

  const ctx: WebMCPVueContext = {
    available: typeof document !== "undefined" && document.modelContext != null,
    native: isNativeModelContext(),
    appName: options.name,
    appVersion: options.version,
    journeyRegistry,
    destroy,
  };

  if (getCurrentInstance()) {
    provide(WEBMCP_INJECTION_KEY, ctx);
  }
  registerScopeCleanup(destroy);
  return ctx;
}

/**
 * Vue 3 plugin (`app.use(createWebMCPPlugin({ name: "my-app" }))`).
 */
export function createWebMCPPlugin(options: ProvideWebMCPOptions): Plugin {
  return {
    install(app: App) {
      const ctx = provideWebMCP(options);
      app.provide(WEBMCP_INJECTION_KEY, ctx);
      const origUnmount = app.unmount.bind(app);
      app.unmount = () => {
        ctx.destroy();
        return origUnmount();
      };
    },
  };
}

export function useWebMCP(): WebMCPVueContext | undefined {
  return getCurrentInstance() ? inject(WEBMCP_INJECTION_KEY, undefined) : undefined;
}

export interface VueToolOptions {
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
 * Register a WebMCP tool for the lifetime of the current Vue component or `effectScope()`.
 */
export function useWebMCPTool(options: VueToolOptions): { dispose: () => void } {
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

  registerScopeCleanup(dispose);
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

export interface VueSyncTool<TState> {
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
 * Bind a Vue reactive `ref` to one or more WebMCP tools whose reducers update state.
 */
export function experimental_useWebMCPSync<TState>(options: {
  initial: TState;
  tools: Record<string, VueSyncTool<TState>>;
}): {
  state: Readonly<Ref<TState>>;
  set: (next: TState) => void;
  update: (fn: (prev: TState) => TState) => void;
  dispose: () => void;
} {
  let current = options.initial;
  const stateRef = ref(current) as Ref<TState>;
  let queue: Promise<void> = Promise.resolve();

  const set = (next: TState) => {
    current = next;
    stateRef.value = next;
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
  registerScopeCleanup(dispose);

  return {
    state: readonly(stateRef) as Readonly<Ref<TState>>,
    set,
    update,
    dispose,
  };
}

/**
 * Register and control a journey from Vue, auto-cleaning up on scope dispose.
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
  const registry = options.registry ?? useWebMCP()?.journeyRegistry;
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
  registerScopeCleanup(dispose);

  return {
    setActive: (active: boolean) => registry?.setJourneyActive(options.name, active),
    dispose,
  };
}

/**
 * Connect a Vue app to `webmcp-bridge` and expose reactive connection status.
 */
export function experimental_useWebMCPBridge(options: {
  url?: string;
  token: string;
}): {
  status: Readonly<Ref<PageBridgeStatus>>;
  disconnect: () => void;
} {
  const statusRef = ref<PageBridgeStatus>("disconnected");
  const client = createPageBridgeClient({
    url: options.url ?? "ws://127.0.0.1:17321/ws",
    token: options.token,
    onStatusChange: (next) => {
      statusRef.value = next;
    },
  });
  client.connect();

  const disconnect = () => client.disconnect();
  registerScopeCleanup(disconnect);

  return {
    status: readonly(statusRef),
    disconnect,
  };
}
