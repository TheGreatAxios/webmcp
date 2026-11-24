import type {
  RegisteredTool,
  RegisterToolOptions,
  ToolAnnotations,
  ToolDescriptor,
  ToolSnapshot,
} from "./types";
import { validateToolDescriptor } from "./validation";

type ChangeListener = () => void;

export interface StoredRegistration {
  readonly id: symbol;
  readonly descriptor: ToolDescriptor;
  readonly exposedTo: readonly string[];
  readonly origin: string;
  readonly source: WindowProxy | null;
}

export interface ToolRegistry {
  register(descriptor: ToolDescriptor, options?: RegisterToolOptions): Promise<void>;
  unregister(name: string): void;
  getTool(name: string): ToolDescriptor | undefined;
  getRegistration(name: string): StoredRegistration | undefined;
  getRegistrationBySnapshot(snapshot: ToolSnapshot): StoredRegistration | undefined;
  listTools(): RegisteredTool[];
  listToolSnapshots(): ToolSnapshot[];
  addChangeListener(listener: ChangeListener): () => void;
}

const SNAPSHOT_IDS = new WeakMap<ToolSnapshot, symbol>();

function cloneJson<T>(value: T | undefined): T | null {
  if (value === undefined) return null;
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeAnnotations(annotations: ToolAnnotations | undefined): ToolAnnotations | null {
  if (!annotations) return null;
  return {
    readOnlyHint: Boolean(annotations.readOnlyHint),
    untrustedContentHint: Boolean(annotations.untrustedContentHint),
    consequentialHint: Boolean(annotations.consequentialHint),
    debugging: Boolean(annotations.debugging),
  };
}

function currentOrigin(): string {
  if (typeof globalThis.location?.origin === "string" && globalThis.location.origin !== "null") {
    return globalThis.location.origin;
  }
  return "null";
}

function currentWindow(): WindowProxy | null {
  return typeof globalThis.window !== "undefined" ? (globalThis.window as WindowProxy) : null;
}

export function createToolRegistry(): ToolRegistry {
  const registrations = new Map<string, StoredRegistration>();
  const listeners = new Set<ChangeListener>();
  const abortCleanups = new Map<string, () => void>();

  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const toSnapshot = (reg: StoredRegistration): ToolSnapshot => {
    const snap: ToolSnapshot = Object.freeze({
      name: reg.descriptor.name,
      title: reg.descriptor.title ?? "",
      description: reg.descriptor.description,
      inputSchema: cloneJson(reg.descriptor.inputSchema),
      outputSchema: cloneJson(reg.descriptor.outputSchema),
      source: reg.source,
      origin: reg.origin,
      annotations: normalizeAnnotations(reg.descriptor.annotations),
    });
    SNAPSHOT_IDS.set(snap, reg.id);
    return snap;
  };

  return {
    async register(descriptor, options) {
      if (options?.signal?.aborted) {
        throw options.signal.reason ?? new DOMException("Aborted", "AbortError");
      }

      validateToolDescriptor(descriptor);

      if (registrations.has(descriptor.name)) {
        throw new DOMException(
          `Tool "${descriptor.name}" is already registered`,
          "InvalidStateError",
        );
      }

      const reg: StoredRegistration = {
        id: Symbol(descriptor.name),
        descriptor,
        exposedTo: options?.exposedTo ? [...options.exposedTo] : [],
        origin: currentOrigin(),
        source: currentWindow(),
      };
      registrations.set(descriptor.name, reg);

      if (options?.signal) {
        const signal = options.signal;
        const onAbort = () => {
          const current = registrations.get(descriptor.name);
          if (current?.id === reg.id) {
            registrations.delete(descriptor.name);
            abortCleanups.delete(descriptor.name);
            notify();
          }
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
      if (registrations.delete(name)) {
        notify();
      }
    },

    getTool(name) {
      return registrations.get(name)?.descriptor;
    },

    getRegistration(name) {
      return registrations.get(name);
    },

    getRegistrationBySnapshot(snapshot) {
      const id = SNAPSHOT_IDS.get(snapshot);
      if (!id) return undefined;
      const current = registrations.get(snapshot.name);
      return current?.id === id ? current : undefined;
    },

    listTools() {
      return Array.from(registrations.values()).map(({ descriptor: tool }) => ({
        name: tool.name,
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema,
        annotations: tool.annotations,
      }));
    },

    listToolSnapshots() {
      return Array.from(registrations.values()).map(toSnapshot);
    },

    addChangeListener(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
