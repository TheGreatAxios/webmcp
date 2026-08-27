import type { CallToolResult, JsonSchema, ToolAnnotations } from "./types";
import { installPolyfill, cleanupPolyfill } from "./polyfill";

const PROVIDER_TAG = "webmcp-provider";
const TOOL_TAG = "webmcp-tool";
const JOURNEY_TAG = "webmcp-journey";

function parseJsonAttr(value: string | null): JsonSchema | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as JsonSchema;
  } catch {
    return undefined;
  }
}

class WebMCPProviderElement extends HTMLElement {
  connectedCallback() {
    installPolyfill();
    this.dispatchEvent(new CustomEvent("webmcp-ready", { bubbles: true }));
  }

  disconnectedCallback() {
    cleanupPolyfill();
  }
}

class WebMCPToolElement extends HTMLElement {
  #controller: AbortController | null = null;

  connectedCallback() {
    const name = this.getAttribute("name");
    const description = this.getAttribute("description");
    if (!name || !description) return;

    const inputSchema = parseJsonAttr(this.getAttribute("input-schema"));
    const annotations = parseJsonAttr(this.getAttribute("annotations")) as ToolAnnotations | undefined;
    const title = this.getAttribute("title") ?? undefined;

    this.#controller = new AbortController();

    const execute = async (args: Record<string, unknown>): Promise<CallToolResult> => {
      const event = new CustomEvent("invoke", {
        detail: { args },
        cancelable: true,
      });
      this.dispatchEvent(event);
      if (event.defaultPrevented) {
        return { content: [{ type: "text", text: "Cancelled" }], isError: true };
      }
      const handler = (this as unknown as { _handler?: (args: Record<string, unknown>) => Promise<CallToolResult> })._handler;
      if (handler) return await handler(args);
      return { content: [{ type: "text", text: "No handler bound" }], isError: true };
    };

    const register = async () => {
      if (!document.modelContext) return;
      await document.modelContext.registerTool(
        {
          name,
          title,
          description,
          inputSchema,
          annotations,
          execute,
        },
        { signal: this.#controller!.signal },
      );
    };

    register().catch(() => {
      /* registration errors surface via modelContext promise rejection */
    });
  }

  disconnectedCallback() {
    this.#controller?.abort();
    this.#controller = null;
  }

  /** Bind handler from framework adapters (React, etc.) */
  bindHandler(handler: (args: Record<string, unknown>) => Promise<CallToolResult>) {
    (this as unknown as { _handler: typeof handler })._handler = handler;
  }
}

class WebMCPJourneyElement extends HTMLElement {
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
}

export function registerWebMCPElements(): void {
  if (typeof customElements === "undefined") return;
  if (!customElements.get(PROVIDER_TAG)) {
    customElements.define(PROVIDER_TAG, WebMCPProviderElement);
  }
  if (!customElements.get(TOOL_TAG)) {
    customElements.define(TOOL_TAG, WebMCPToolElement);
  }
  if (!customElements.get(JOURNEY_TAG)) {
    customElements.define(JOURNEY_TAG, WebMCPJourneyElement);
  }
}

export { WebMCPProviderElement, WebMCPToolElement, WebMCPJourneyElement };
export const WEBMCP_TAGS = { PROVIDER: PROVIDER_TAG, TOOL: TOOL_TAG, JOURNEY: JOURNEY_TAG };
