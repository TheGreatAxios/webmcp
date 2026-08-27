import {
  createContext,
  useCallback,
  useContext,
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
  const resolverRef = useRef<((approved: boolean) => void) | null>(null);

  const request = useCallback((tool: string, args: Record<string, unknown>) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setPending({
        tool,
        args,
        approve: () => {
          setPending(null);
          resolverRef.current?.(true);
          resolverRef.current = null;
        },
        reject: () => {
          setPending(null);
          resolverRef.current?.(false);
          resolverRef.current = null;
        },
      });
    });
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
        if (requiresConfirm && requestConfirmation) {
          const approved = await requestConfirmation(name, args);
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
