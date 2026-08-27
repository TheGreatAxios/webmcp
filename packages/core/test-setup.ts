// Stubs for Node test environment
class StubEventTarget {
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() {
    return true;
  }
}

class StubHTMLElement extends StubEventTarget {
  getAttribute() {
    return null;
  }
  setAttribute() {}
  dispatchEvent() {
    return true;
  }
}

if (typeof globalThis.EventTarget === "undefined") {
  (globalThis as { EventTarget: typeof EventTarget }).EventTarget =
    StubEventTarget as unknown as typeof EventTarget;
}
if (typeof globalThis.HTMLElement === "undefined") {
  (globalThis as { HTMLElement: typeof HTMLElement }).HTMLElement =
    StubHTMLElement as unknown as typeof HTMLElement;
}
if (typeof globalThis.customElements === "undefined") {
  (globalThis as { customElements: CustomElementRegistry }).customElements = {
    get: () => undefined,
    define: () => {},
  } as CustomElementRegistry;
}
if (typeof globalThis.document === "undefined") {
  (globalThis as { document: Document }).document = {} as Document;
}
if (typeof globalThis.navigator === "undefined") {
  (globalThis as { navigator: Navigator }).navigator = {} as Navigator;
}
