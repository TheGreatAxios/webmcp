/// <reference path="./jsx.d.ts" />
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  cleanupPolyfill,
  experimental_createJourneyRegistry,
  installPolyfill,
  isNativeModelContext,
  registerWebMCPElements,
  setJourneyRegistry,
  type CallToolResult,
  type JsonSchema,
  type JourneyRegistry,
  type ToolAnnotations,
  type ToolDescriptor,
  type ToolExecuteCallbackOptions,
} from "@thegreataxios/webmcp-core";

export interface WebMCPContextValue {
  available: boolean;
  native: boolean;
  appName?: string;
  appVersion?: string;
  journeyRegistry: JourneyRegistry;
}

const WebMCPContext = createContext<WebMCPContextValue>({
  available: false,
  native: false,
  journeyRegistry: experimental_createJourneyRegistry(),
});

export interface WebMCPProviderProps {
  name: string;
  version?: string;
  children: ReactNode;
}

export function WebMCPProvider({ name, version, children }: WebMCPProviderProps) {
  const journeyRegistry = useMemo(() => experimental_createJourneyRegistry(), []);
  const [available, setAvailable] = useState(false);

  useLayoutEffect(() => {
    registerWebMCPElements();
    // Registry first: createModelContext subscribes to it at install time,
    // so journey switches also emit toolchange (the bridge syncs on it).
    setJourneyRegistry(journeyRegistry);
    installPolyfill();
    setAvailable(typeof document !== "undefined" && document.modelContext != null);
  }, [journeyRegistry]);

  useEffect(() => {
    return () => {
      setJourneyRegistry(null);
      cleanupPolyfill();
    };
  }, []);

  const value = useMemo(
    () => ({
      available,
      native: isNativeModelContext(),
      appName: name,
      appVersion: version,
      journeyRegistry,
    }),
    [available, name, version, journeyRegistry],
  );

  return (
    <div data-webmcp-provider data-name={name} data-version={version ?? ""}>
      <WebMCPContext.Provider value={value}>{children}</WebMCPContext.Provider>
    </div>
  );
}

export function useWebMCP(): WebMCPContextValue {
  return useContext(WebMCPContext);
}

/**
 * Signal async tool registration stability to `document.modelContext.waitForToolsUntil`.
 */
export function useWaitForToolsUntil(promise: Promise<unknown> | null | undefined): void {
  const { available } = useWebMCP();
  useEffect(() => {
    if (!available || !promise || typeof document === "undefined") return;
    document.modelContext?.waitForToolsUntil?.(promise);
  }, [available, promise]);
}

const TOOL_OWNERS = new Map<string, symbol>();

export interface WebMCPToolProps {
  name: string;
  description: string;
  title?: string;
  inputSchema?: JsonSchema;
  outputSchema?: JsonSchema;
  annotations?: ToolAnnotations;
  exposedTo?: string[];
  handler: (
    args: Record<string, unknown>,
    options?: ToolExecuteCallbackOptions,
  ) => CallToolResult | unknown | Promise<CallToolResult | unknown>;
}

export function WebMCPTool({
  name,
  description,
  title,
  inputSchema,
  outputSchema,
  annotations,
  exposedTo,
  handler,
}: WebMCPToolProps) {
  const { available } = useWebMCP();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const schemaKey = useMemo(
    () => JSON.stringify({ inputSchema, outputSchema, annotations, title, exposedTo }),
    [inputSchema, outputSchema, annotations, title, exposedTo],
  );

  const stableHandler = useCallback(
    async (args: Record<string, unknown>, options?: ToolExecuteCallbackOptions) => {
      return await handlerRef.current(args, options);
    },
    [],
  );

  useEffect(() => {
    if (!available || typeof document === "undefined" || !document.modelContext) return;

    const owner = Symbol(name);
    const isOwner = !TOOL_OWNERS.has(name);
    if (isOwner) {
      TOOL_OWNERS.set(name, owner);
    }

    const controller = new AbortController();
    const descriptor: ToolDescriptor = {
      name,
      title,
      description,
      inputSchema,
      outputSchema,
      annotations,
      execute: stableHandler,
    };

    if (isOwner) {
      document.modelContext
        .registerTool(descriptor, { signal: controller.signal, exposedTo })
        .catch(() => {});
    }

    return () => {
      if (TOOL_OWNERS.get(name) !== owner) return;
      TOOL_OWNERS.delete(name);
      controller.abort();
    };
  }, [available, name, description, schemaKey, stableHandler]);

  return null;
}
