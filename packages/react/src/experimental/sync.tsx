import { useRef, useState, type Dispatch, type SetStateAction, type ReactNode } from "react";
import type { CallToolResult } from "@thegreataxios/webmcp-core";
import { WebMCPTool } from "../provider";

export interface WebMCPSyncOptions<T> {
  initial: T;
  tools: Record<string, (state: T, args: Record<string, unknown>) => T | Promise<T>>;
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
  /** Render inside WebMCPProvider to register sync-bound tools */
  Tools: ReactNode;
}

/**
 * experimental — binds local state to tool handlers so agent invocations update UI.
 */
export function experimental_useWebMCPSync<T>(options: WebMCPSyncOptions<T>): WebMCPSyncResult<T> {
  const [state, setState] = useState<T>(options.initial);
  const stateRef = useRef(state);
  stateRef.current = state;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const Tools = (
    <>
      {Object.entries(options.tools).map(([name, reducer]) => (
        <WebMCPTool
          key={name}
          name={name}
          description={`State-synced tool: ${name}`}
          handler={async (args) => {
            const previous = stateRef.current;
            const next = await reducer(previous, args);
            setState(next);
            optionsRef.current.onMutation?.({ tool: name, args, previous, next });
            return {
              content: [{ type: "text", text: JSON.stringify(next) }],
              structuredContent: next as Record<string, unknown>,
            } satisfies CallToolResult;
          }}
        />
      ))}
    </>
  );

  return { state, setState, Tools };
}
