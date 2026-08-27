import type { RegisteredTool, ToolDescriptor } from "./types";
import { validateToolDescriptor } from "./validation";

type ChangeListener = () => void;

export interface ToolRegistry {
  register(descriptor: ToolDescriptor, options?: { signal?: AbortSignal }): Promise<void>;
  unregister(name: string): void;
  getTool(name: string): ToolDescriptor | undefined;
  listTools(): RegisteredTool[];
  addChangeListener(listener: ChangeListener): () => void;
}

export function createToolRegistry(): ToolRegistry {
  const tools = new Map<string, ToolDescriptor>();
  const listeners = new Set<ChangeListener>();
  const abortCleanups = new Map<string, () => void>();

  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  return {
    async register(descriptor, options) {
      if (options?.signal?.aborted) {
        throw options.signal.reason ?? new DOMException("Aborted", "AbortError");
      }

      validateToolDescriptor(descriptor);

      if (tools.has(descriptor.name)) {
        throw new DOMException(
          `Tool "${descriptor.name}" is already registered`,
          "InvalidStateError",
        );
      }

      tools.set(descriptor.name, descriptor);

      if (options?.signal) {
        const signal = options.signal;
        const onAbort = () => {
          tools.delete(descriptor.name);
          abortCleanups.delete(descriptor.name);
          notify();
        };
        signal.addEventListener("abort", onAbort, { once: true });
        abortCleanups.set(descriptor.name, () => signal.removeEventListener("abort", onAbort));
      }

      notify();
    },

    unregister(name) {
      const cleanup = abortCleanups.get(name);
      if (cleanup) {
        cleanup();
        abortCleanups.delete(name);
      }
      if (tools.delete(name)) {
        notify();
      }
    },

    getTool(name) {
      return tools.get(name);
    },

    listTools() {
      return Array.from(tools.values()).map((tool) => ({
        name: tool.name,
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema,
        annotations: tool.annotations,
      }));
    },

    addChangeListener(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
