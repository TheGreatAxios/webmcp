/// <reference path="./jsx.d.ts" />
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  cleanupPolyfill,
  installPolyfill,
  isNativeModelContext,
  registerWebMCPElements,
  type CallToolResult,
  type JsonSchema,
  type ToolAnnotations,
  type ToolDescriptor,
} from "@thegreataxios/webmcp-core";

registerWebMCPElements();

export interface WebMCPContextValue {
  available: boolean;
  native: boolean;
  appName?: string;
  appVersion?: string;
}

const WebMCPContext = createContext<WebMCPContextValue>({
  available: false,
  native: false,
});

export interface WebMCPProviderProps {
  name: string;
  version?: string;
  children: ReactNode;
}

export function WebMCPProvider({ name, version, children }: WebMCPProviderProps) {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    installPolyfill();
    setAvailable(typeof document !== "undefined" && document.modelContext != null);
    return () => cleanupPolyfill();
  }, []);

  const value = useMemo(
    () => ({
      available,
      native: isNativeModelContext(),
      appName: name,
      appVersion: version,
    }),
    [available, name, version],
  );

  return (
    <webmcp-provider data-name={name} data-version={version ?? ""}>
      <WebMCPContext.Provider value={value}>{children}</WebMCPContext.Provider>
    </webmcp-provider>
  );
}

export function useWebMCP(): WebMCPContextValue {
  return useContext(WebMCPContext);
}

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
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const stableHandler = useCallback(async (args: Record<string, unknown>) => {
    return await handlerRef.current(args);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined" || !document.modelContext) return;

    const controller = new AbortController();
    const descriptor: ToolDescriptor = {
      name,
      title,
      description,
      inputSchema,
      annotations,
      execute: stableHandler,
    };

    const result = document.modelContext.registerTool(descriptor, {
      signal: controller.signal,
      exposedTo,
    });

    if (result && typeof (result as Promise<unknown>).then === "function") {
      (result as Promise<unknown>).catch(() => {});
    }

    return () => controller.abort();
  }, [name, description, title, inputSchema, annotations, exposedTo, stableHandler]);

  return (
    <webmcp-tool
      name={name}
      description={description}
      title={title ?? undefined}
      input-schema={inputSchema ? JSON.stringify(inputSchema) : undefined}
      annotations={annotations ? JSON.stringify(annotations) : undefined}
    />
  );
}
