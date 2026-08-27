import { installPolyfill, cleanupPolyfill } from "./polyfill";

const PROVIDER_TAG = "webmcp-provider";
const JOURNEY_TAG = "webmcp-journey";

type ProviderElement = HTMLElement;
type JourneyElement = HTMLElement;

let providerElementClass: { new (): ProviderElement } | null = null;
let journeyElementClass: { new (): JourneyElement } | null = null;

function ensureElementClasses(): void {
  if (typeof HTMLElement === "undefined") return;
  if (providerElementClass && journeyElementClass) return;

  providerElementClass = class WebMCPProviderElement extends HTMLElement {
    connectedCallback() {
      installPolyfill();
      this.dispatchEvent(new CustomEvent("webmcp-ready", { bubbles: true }));
    }

    disconnectedCallback() {
      cleanupPolyfill();
    }
  };

  journeyElementClass = class WebMCPJourneyElement extends HTMLElement {
    connectedCallback() {
      const name = this.getAttribute("name");
      if (!name) return;
      this.dispatchEvent(
        new CustomEvent("webmcp-journey-active", {
          detail: { name, active: true },
          bubbles: true,
        }),
      );
    }

    disconnectedCallback() {
      const name = this.getAttribute("name");
      if (!name) return;
      this.dispatchEvent(
        new CustomEvent("webmcp-journey-active", {
          detail: { name, active: false },
          bubbles: true,
        }),
      );
    }
  };
}

export function registerWebMCPElements(): void {
  if (typeof customElements === "undefined") return;
  ensureElementClasses();
  if (!providerElementClass || !journeyElementClass) return;

  if (!customElements.get(PROVIDER_TAG)) {
    customElements.define(PROVIDER_TAG, providerElementClass);
  }
  if (!customElements.get(JOURNEY_TAG)) {
    customElements.define(JOURNEY_TAG, journeyElementClass);
  }
}

export function WebMCPProviderElement(): ProviderElement {
  ensureElementClasses();
  if (!providerElementClass) {
    throw new Error("HTMLElement is not available in this environment");
  }
  return new providerElementClass();
}

export function WebMCPJourneyElement(): JourneyElement {
  ensureElementClasses();
  if (!journeyElementClass) {
    throw new Error("HTMLElement is not available in this environment");
  }
  return new journeyElementClass();
}

export const WEBMCP_TAGS = { PROVIDER: PROVIDER_TAG, JOURNEY: JOURNEY_TAG };
