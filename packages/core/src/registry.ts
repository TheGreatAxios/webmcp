import type { RegisteredTool, ToolDescriptor } from "./types";

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
  const abortControllers = new Map<string, AbortController>();

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
      if (!descriptor.name || !descriptor.description || typeof descriptor.execute !== "function") {
        throw new TypeError("Invalid tool descriptor");
      }
      if (tools.has(descriptor.name)) {
        throw new DOMException(`Tool "${descriptor.name}" already registered`, "InvalidStateError");
      }

      tools.set(descriptor.name, descriptor);

      if (options?.signal) {
        const onAbort = () => {
          tools.delete(descriptor.name);
          abortControllers.delete(descriptor.name);
          notify();
        };
        options.signal.addEventListener("abort", onAbort, { once: true });
        abortControllers.set(descriptor.name, new AbortController());
      }

      notify();
    },

    unregister(name) {
      if (tools.delete(name)) {
        abortControllers.delete(name);
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
