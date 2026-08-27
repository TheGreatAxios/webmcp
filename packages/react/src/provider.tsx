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
} from "@thegreataxios/webmcp-core";

export interface WebMCPContextValue {
  available: boolean;
  native: boolean;
  appName?: string;
  appVersion?: string;
  journeyRegistry: JourneyRegistry;
}

const defaultJourneyRegistry = experimental_createJourneyRegistry();

const WebMCPContext = createContext<WebMCPContextValue>({
  available: false,
  native: false,
  journeyRegistry: defaultJourneyRegistry,
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
    installPolyfill();
    setJourneyRegistry(journeyRegistry);
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

const TOOL_OWNERS = new Map<string, symbol>();

export interface WebMCPToolProps {
  name: string;
  description: string;
  title?: string;
  inputSchema?: JsonSchema;
  annotations?: ToolAnnotations;
  exposedTo?: string[];
  handler: (args: Record<string, unknown>) => CallToolResult | Promise<CallToolResult>;
}

export function WebMCPTool({
  name,
  description,
  title,
  inputSchema,
  annotations,
  exposedTo,
  handler,
}: WebMCPToolProps) {
  const { available } = useWebMCP();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const schemaKey = useMemo(() => JSON.stringify({ inputSchema, annotations, title }), [
    inputSchema,
    annotations,
    title,
  ]);

  const stableHandler = useCallback(async (args: Record<string, unknown>) => {
    return await handlerRef.current(args);
  }, []);

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
  }, [available, name, description, schemaKey, exposedTo, stableHandler]);

  return null;
}
