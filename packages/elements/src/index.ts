import {
  cleanupPolyfill,
  createPageBridgeClient,
  experimental_createJourneyRegistry,
  getJourneyRegistry,
  installPolyfill,
  setJourneyRegistry,
  type JsonSchema,
  type ToolAnnotations,
  type ToolExecuteCallback,
  type ToolExecuteCallbackOptions,
} from "@thegreataxios/webmcp-core";

export const WEBMCP_ELEMENT_TAGS = {
  PROVIDER: "webmcp-provider",
  TOOL: "webmcp-tool",
  JOURNEY: "webmcp-journey",
} as const;

export interface WebMCPExecuteEventDetail {
  args: Record<string, unknown>;
  signal?: AbortSignal;
  respondWith: (value: unknown | Promise<unknown>) => void;
}

export interface WebMCPToolElementInstance extends HTMLElement {
  execute: ToolExecuteCallback | null;
  inputSchema: JsonSchema | undefined;
  outputSchema: JsonSchema | undefined;
}

function parseJsonSlot(el: HTMLElement, slotName: string): JsonSchema | undefined {
  const script = el.querySelector(`script[type="application/json"][slot="${slotName}"]`);
  if (!script?.textContent) return undefined;
  const parsed = JSON.parse(script.textContent) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new DOMException(`${slotName} must be a JSON object`, "SyntaxError");
  }
  return parsed as JsonSchema;
}

function parseCsvAttr(el: HTMLElement, name: string): string[] | undefined {
  const raw = el.getAttribute(name);
  if (!raw) return undefined;
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length > 0 ? list : undefined;
}

let providerCtor: CustomElementConstructor | null = null;
let toolCtor: CustomElementConstructor | null = null;
let journeyCtor: CustomElementConstructor | null = null;

function ensureElementClasses(): void {
  if (typeof HTMLElement === "undefined") return;
  if (providerCtor && toolCtor && journeyCtor) return;

  providerCtor = class WebMCPProviderElement extends HTMLElement {
    #bridgeClient: ReturnType<typeof createPageBridgeClient> | null = null;

    connectedCallback(): void {
      installPolyfill();
      const bridgeUrl = this.getAttribute("bridge-url");
      const bridgeToken = this.getAttribute("bridge-token");
      if (bridgeUrl && bridgeToken) {
        this.#bridgeClient = createPageBridgeClient({
          url: bridgeUrl,
          token: bridgeToken,
          onStatusChange: (status) => {
            this.dispatchEvent(
              new CustomEvent("webmcp-bridge-status", { detail: { status }, bubbles: true }),
            );
          },
        });
        this.#bridgeClient.connect();
      }
      this.dispatchEvent(new CustomEvent("webmcp-ready", { bubbles: true }));
    }

    disconnectedCallback(): void {
      this.#bridgeClient?.disconnect();
      this.#bridgeClient = null;
      cleanupPolyfill();
    }
  };

  toolCtor = class WebMCPToolElement extends HTMLElement implements WebMCPToolElementInstance {
    static get observedAttributes(): string[] {
      return [
        "name",
        "title",
        "description",
        "read-only",
        "untrusted-content",
        "consequential",
        "debugging",
        "exposed-to",
      ];
    }

    #controller: AbortController | null = null;
    #execute: ToolExecuteCallback | null = null;
    #inputSchema: JsonSchema | undefined;
    #outputSchema: JsonSchema | undefined;
    #waitingForReady: (() => void) | null = null;

    get execute(): ToolExecuteCallback | null {
      return this.#execute;
    }

    set execute(fn: ToolExecuteCallback | null) {
      this.#execute = fn;
      if (this.isConnected) {
        this.#reregister();
      }
    }

    get inputSchema(): JsonSchema | undefined {
      return this.#inputSchema;
    }

    set inputSchema(schema: JsonSchema | undefined) {
      this.#inputSchema = schema;
      if (this.isConnected) {
        this.#reregister();
      }
    }

    get outputSchema(): JsonSchema | undefined {
      return this.#outputSchema;
    }

    set outputSchema(schema: JsonSchema | undefined) {
      this.#outputSchema = schema;
      if (this.isConnected) {
        this.#reregister();
      }
    }

    connectedCallback(): void {
      this.#reregister();
    }

    attributeChangedCallback(): void {
      if (this.isConnected) {
        this.#reregister();
      }
    }

    disconnectedCallback(): void {
      if (this.#waitingForReady && typeof document !== "undefined") {
        document.removeEventListener("webmcp-ready", this.#waitingForReady);
        this.#waitingForReady = null;
      }
      this.#controller?.abort();
      this.#controller = null;
    }

    #readAnnotations(): ToolAnnotations | undefined {
      const hasAny =
        this.hasAttribute("read-only") ||
        this.hasAttribute("untrusted-content") ||
        this.hasAttribute("consequential") ||
        this.hasAttribute("debugging");
      if (!hasAny) return undefined;
      return {
        readOnlyHint: this.hasAttribute("read-only"),
        untrustedContentHint: this.hasAttribute("untrusted-content"),
        consequentialHint: this.hasAttribute("consequential"),
        debugging: this.hasAttribute("debugging"),
      };
    }

    #reregister(): void {
      this.#controller?.abort();
      this.#controller = null;

      if (typeof document === "undefined") return;
      if (!document.modelContext) {
        if (!this.#waitingForReady) {
          this.#waitingForReady = () => {
            if (this.#waitingForReady) {
              document.removeEventListener("webmcp-ready", this.#waitingForReady);
              this.#waitingForReady = null;
            }
            if (this.isConnected) {
              this.#reregister();
            }
          };
          document.addEventListener("webmcp-ready", this.#waitingForReady);
        }
        return;
      }
      const name = this.getAttribute("name")?.trim();
      const description = this.getAttribute("description")?.trim();
      if (!name || !description) return;

      const controller = new AbortController();
      this.#controller = controller;

      const inputSchema = this.#inputSchema ?? parseJsonSlot(this, "input-schema");
      const outputSchema = this.#outputSchema ?? parseJsonSlot(this, "output-schema");
      const exposedTo = parseCsvAttr(this, "exposed-to");
      const title = this.getAttribute("title") ?? undefined;
      const annotations = this.#readAnnotations();

      const execute: ToolExecuteCallback = async (
        args: Record<string, unknown>,
        options?: ToolExecuteCallbackOptions,
      ) => {
        if (this.#execute) {
          return await this.#execute(args, options);
        }
        let responded = false;
        let responseValue: unknown;
        const detail: WebMCPExecuteEventDetail = {
          args,
          signal: options?.signal,
          respondWith(value) {
            responded = true;
            responseValue = value;
          },
        };
        this.dispatchEvent(new CustomEvent("webmcp-execute", { detail, bubbles: true }));
        if (!responded) {
          throw new DOMException(
            `No execute handler or webmcp-execute listener responded for "${name}"`,
            "OperationError",
          );
        }
        return await responseValue;
      };

      document.modelContext
        .registerTool(
          { name, title, description, inputSchema, outputSchema, annotations, execute },
          { signal: controller.signal, exposedTo },
        )
        .catch(() => {});
    }
  };

  journeyCtor = class WebMCPJourneyElement extends HTMLElement {
    static get observedAttributes(): string[] {
      return ["name", "tools", "active", "description"];
    }

    #registeredName: string | null = null;

    connectedCallback(): void {
      this.#sync();
    }

    attributeChangedCallback(): void {
      if (this.isConnected) {
        this.#sync();
      }
    }

    disconnectedCallback(): void {
      const registry = getJourneyRegistry();
      if (registry && this.#registeredName) {
        registry.unregister(this.#registeredName);
      }
      this.#registeredName = null;
    }

    #sync(): void {
      const name = this.getAttribute("name")?.trim();
      if (!name) return;

      let registry = getJourneyRegistry();
      if (!registry) {
        registry = experimental_createJourneyRegistry();
        setJourneyRegistry(registry);
      }

      if (this.#registeredName && this.#registeredName !== name) {
        registry.unregister(this.#registeredName);
      }

      const tools = parseCsvAttr(this, "tools") ?? [];
      const description = this.getAttribute("description") ?? undefined;
      registry.register({ name, description, tools });
      registry.setJourneyActive(name, this.hasAttribute("active"));
      this.#registeredName = name;
    }
  };
}

/**
 * Define `<webmcp-provider>`, `<webmcp-tool>`, and `<webmcp-journey>` custom elements.
 * Safe to call multiple times or in SSR environments.
 */
export function registerWebMCPElements(): void {
  if (typeof customElements === "undefined") return;
  ensureElementClasses();
  if (!providerCtor || !toolCtor || !journeyCtor) return;

  if (!customElements.get(WEBMCP_ELEMENT_TAGS.PROVIDER)) {
    customElements.define(WEBMCP_ELEMENT_TAGS.PROVIDER, providerCtor);
  }
  if (!customElements.get(WEBMCP_ELEMENT_TAGS.TOOL)) {
    customElements.define(WEBMCP_ELEMENT_TAGS.TOOL, toolCtor);
  }
  if (!customElements.get(WEBMCP_ELEMENT_TAGS.JOURNEY)) {
    customElements.define(WEBMCP_ELEMENT_TAGS.JOURNEY, journeyCtor);
  }
}
