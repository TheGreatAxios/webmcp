import {
  useCallback,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { CallToolResult, JsonSchema, ToolAnnotations } from "@thegreataxios/webmcp-core";
import { WebMCPTool } from "../provider";

type WebMCPSyncReducer<T> = (
  state: T,
  args: Record<string, unknown>,
) => T | Promise<T>;

export type WebMCPSyncTool<T> =
  | WebMCPSyncReducer<T>
  | {
      reducer: WebMCPSyncReducer<T>;
      description: string;
      title?: string;
      inputSchema?: JsonSchema;
      annotations?: ToolAnnotations;
    };

export interface WebMCPSyncOptions<T> {
  initial: T;
  tools: Record<string, WebMCPSyncTool<T>>;
  onMutation?: (info: {
    tool: string;
    args: Record<string, unknown>;
    previous: T;
    next: T;
  }) => void;
}

export interface WebMCPSyncResult<T> {
  state: T;
  setState: Dispatch<SetStateAction<T>>;
  Tools: ReactNode;
}

/** experimental — agent tool calls update React state automatically */
export function experimental_useWebMCPSync<T>(options: WebMCPSyncOptions<T>): WebMCPSyncResult<T> {
  const [state, setReactState] = useState<T>(options.initial);
  const stateRef = useRef(state);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve());

  const setState = useCallback<Dispatch<SetStateAction<T>>>((action) => {
    const next =
      typeof action === "function"
        ? (action as (value: T) => T)(stateRef.current)
        : action;
    stateRef.current = next;
    setReactState(next);
  }, []);

  const Tools = (
    <>
      {Object.entries(options.tools).map(([name, tool]) => {
        const metadata = typeof tool === "function" ? null : tool;
        const reducer = typeof tool === "function" ? tool : tool.reducer;

        return (
          <WebMCPTool
            key={name}
            name={name}
            title={metadata?.title}
            description={metadata?.description ?? `State-synced: ${name}`}
            inputSchema={metadata?.inputSchema}
            annotations={metadata?.annotations}
            handler={(args) => {
              const run = mutationQueueRef.current.then(async (): Promise<CallToolResult> => {
                try {
                  const previous = stateRef.current;
                  const next = await reducer(previous, args);
                  setState(next);
                  optionsRef.current.onMutation?.({ tool: name, args, previous, next });
                  return {
                    content: [{ type: "text", text: JSON.stringify(next) }],
                    structuredContent: next as Record<string, unknown>,
                  };
                } catch (error) {
                  return {
                    content: [
                      {
                        type: "text",
                        text: error instanceof Error ? error.message : "State mutation failed",
                      },
                    ],
                    isError: true,
                  };
                }
              });
              mutationQueueRef.current = run.then(
                () => undefined,
                () => undefined,
              );
              return run;
            }}
          />
        );
      })}
    </>
  );

  return { state, setState, Tools };
}
