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
import type {
  CallToolResult,
  JsonSchema,
  ToolAnnotations,
  ToolExecuteCallbackOptions,
} from "@thegreataxios/webmcp-core";
import { WebMCPTool } from "../provider";

export interface PendingConfirmation {
  readonly tool: string;
  readonly args: Record<string, unknown>;
  readonly approve: () => void;
  readonly reject: (reason?: string) => void;
}

interface ConfirmContextValue {
  readonly pending: PendingConfirmation | null;
  readonly request: (tool: string, args: Record<string, unknown>) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function experimental_WebMCPConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const queueRef = useRef<
    Array<{
      tool: string;
      args: Record<string, unknown>;
      resolve: (approved: boolean) => void;
    }>
  >([]);
  const mountedRef = useRef(true);

  const showNext = useCallback(() => {
    const next = queueRef.current[0];
    if (!next || !mountedRef.current) {
      setPending(null);
      return;
    }
    const settle = (approved: boolean) => {
      if (queueRef.current[0] !== next) return;
      queueRef.current.shift();
      next.resolve(approved);
      if (mountedRef.current) {
        setPending(null);
        queueMicrotask(() => showNext());
      }
    };
    setPending({
      tool: next.tool,
      args: next.args,
      approve: () => settle(true),
      reject: () => settle(false),
    });
  }, []);

  const request = useCallback(
    (tool: string, args: Record<string, unknown>) => {
      return new Promise<boolean>((resolve) => {
        if (!mountedRef.current) {
          resolve(false);
          return;
        }
        queueRef.current.push({ tool, args, resolve });
        if (queueRef.current.length === 1) showNext();
      });
    },
    [showNext],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      for (const queued of queueRef.current.splice(0)) queued.resolve(false);
    };
  }, []);

  const contextValue = useMemo<ConfirmContextValue>(
    () => ({ pending, request }),
    [pending, request],
  );

  return <ConfirmContext.Provider value={contextValue}>{children}</ConfirmContext.Provider>;
}

export function experimental_useWebMCPConfirm() {
  const ctx = useContext(ConfirmContext);
  return {
    pending: ctx?.pending ?? null,
    requestConfirmation: ctx?.request,
  };
}

export interface GuardedToolProps {
  name: string;
  title?: string;
  description: string;
  inputSchema?: JsonSchema;
  outputSchema?: JsonSchema;
  annotations?: ToolAnnotations;
  exposedTo?: string[];
  requiresConfirm?: boolean;
  handler: (
    args: Record<string, unknown>,
    options?: ToolExecuteCallbackOptions,
  ) => CallToolResult | unknown | Promise<CallToolResult | unknown>;
}

/** experimental — wraps WebMCPTool with optional confirmation gate */
export function experimental_WebMCPGuardedTool({
  name,
  title,
  description,
  inputSchema,
  outputSchema,
  annotations,
  exposedTo,
  requiresConfirm = true,
  handler,
}: GuardedToolProps) {
  const { requestConfirmation } = experimental_useWebMCPConfirm();

  return (
    <WebMCPTool
      name={name}
      title={title}
      description={description}
      inputSchema={inputSchema}
      outputSchema={outputSchema}
      annotations={annotations}
      exposedTo={exposedTo}
      handler={async (args, options) => {
        if (requiresConfirm && !requestConfirmation) {
          return {
            content: [{ type: "text", text: "Confirmation provider unavailable" }],
            isError: true,
          };
        }
        if (requiresConfirm) {
          const approved = await requestConfirmation!(name, args);
          if (options?.signal?.aborted) {
            throw options.signal.reason ?? new DOMException("Aborted", "AbortError");
          }
          if (!approved) {
            return {
              content: [{ type: "text", text: "User declined" }],
              isError: true,
            };
          }
        }
        return await handler(args, options);
      }}
    />
  );
}
