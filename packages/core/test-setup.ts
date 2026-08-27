// Stubs for Node test environment when happy-dom is not used
class StubEventTarget {
  private listeners: Map<string, Set<(event: Event) => void>> = new Map();

  addEventListener(type: string, listener: (event: Event) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: (event: Event) => void) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event: Event) {
    this.listeners.get(event.type)?.forEach((listener) => listener(event));
    return true;
  }
}

class StubHTMLElement extends StubEventTarget {
  private attrs: Record<string, string> = {};

  getAttribute(name: string) {
    return this.attrs[name] ?? null;
  }

  setAttribute(name: string, value: string) {
    this.attrs[name] = value;
  }
}

class StubCustomEvent extends Event {
  readonly detail: unknown;

  constructor(type: string, init?: { detail?: unknown; bubbles?: boolean }) {
    super(type, { bubbles: init?.bubbles ?? false });
    this.detail = init?.detail;
  }
}

class StubDOMException extends Error {
  readonly name: string;

  constructor(message: string, name = "Error") {
    super(message);
    this.name = name;
  }
}

const documentProps: Record<string, unknown> = {};
const navigatorProps: Record<string, unknown> = {};

if (typeof globalThis.EventTarget === "undefined") {
  (globalThis as { EventTarget: typeof EventTarget }).EventTarget =
    StubEventTarget as unknown as typeof EventTarget;
}
if (typeof globalThis.HTMLElement === "undefined") {
  (globalThis as { HTMLElement: typeof HTMLElement }).HTMLElement =
    StubHTMLElement as unknown as typeof HTMLElement;
}
if (typeof globalThis.Event === "undefined") {
  (globalThis as { Event: typeof Event }).Event = class Event {
    type: string;
    bubbles: boolean;
    constructor(type: string, init?: { bubbles?: boolean }) {
      this.type = type;
      this.bubbles = init?.bubbles ?? false;
    }
  } as unknown as typeof Event;
}
if (typeof globalThis.CustomEvent === "undefined") {
  (globalThis as { CustomEvent: typeof CustomEvent }).CustomEvent =
    StubCustomEvent as unknown as typeof CustomEvent;
}
if (typeof globalThis.DOMException === "undefined") {
  (globalThis as { DOMException: typeof DOMException }).DOMException =
    StubDOMException as unknown as typeof DOMException;
}
if (typeof globalThis.customElements === "undefined") {
  const registry = new Map<string, CustomElementConstructor>();
  (globalThis as { customElements: CustomElementRegistry }).customElements = {
    get: (name: string) => registry.get(name),
    define: (name: string, ctor: CustomElementConstructor) => registry.set(name, ctor),
  } as CustomElementRegistry;
}
if (typeof globalThis.document === "undefined") {
  (globalThis as { document: Document }).document = {
    get modelContext() {
      return documentProps.modelContext;
    },
    set modelContext(value: unknown) {
      documentProps.modelContext = value;
    },
  } as Document;
}
if (typeof globalThis.navigator === "undefined") {
  (globalThis as { navigator: Navigator }).navigator = {
    get modelContextTesting() {
      return navigatorProps.modelContextTesting;
    },
    set modelContextTesting(value: unknown) {
      navigatorProps.modelContextTesting = value;
    },
  } as Navigator;
}
