import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { CallToolResult } from "@thegreataxios/webmcp-core";
import { WebMCPTool } from "../provider";

export interface PendingConfirmation {
  tool: string;
  args: Record<string, unknown>;
  approve: () => void;
  reject: (reason?: string) => void;
}

const ConfirmContext = createContext<{
  pending: PendingConfirmation | null;
  request: (tool: string, args: Record<string, unknown>) => Promise<boolean>;
} | null>(null);

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
  const showNextRef = useRef<() => void>(() => {});

  showNextRef.current = () => {
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
        queueMicrotask(() => showNextRef.current());
      }
    };
    setPending({
      tool: next.tool,
      args: next.args,
      approve: () => settle(true),
      reject: () => settle(false),
    });
  };

  const request = useCallback((tool: string, args: Record<string, unknown>) => {
    return new Promise<boolean>((resolve) => {
      if (!mountedRef.current) {
        resolve(false);
        return;
      }
      queueRef.current.push({ tool, args, resolve });
      if (queueRef.current.length === 1) showNextRef.current();
    });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      for (const queued of queueRef.current.splice(0)) queued.resolve(false);
    };
  }, []);

  return (
    <ConfirmContext.Provider value={{ pending, request }}>
      {children}
    </ConfirmContext.Provider>
  );
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
  description: string;
  inputSchema?: Record<string, unknown>;
  requiresConfirm?: boolean;
  handler: (args: Record<string, unknown>) => CallToolResult | Promise<CallToolResult>;
}

/** experimental — wraps WebMCPTool with optional confirmation gate */
export function experimental_WebMCPGuardedTool({
  name,
  description,
  inputSchema,
  requiresConfirm = true,
  handler,
}: GuardedToolProps) {
  const { requestConfirmation } = experimental_useWebMCPConfirm();

  return (
    <WebMCPTool
      name={name}
      description={description}
      inputSchema={inputSchema}
      handler={async (args) => {
        if (requiresConfirm && !requestConfirmation) {
          return {
            content: [{ type: "text", text: "Confirmation provider unavailable" }],
            isError: true,
          };
        }
        if (requiresConfirm) {
          const approved = await requestConfirmation!(name, args);
          if (!approved) {
            return {
              content: [{ type: "text", text: "User declined" }],
              isError: true,
            };
          }
        }
        return await handler(args);
      }}
    />
  );
}
