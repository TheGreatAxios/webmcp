/**
 * Experimental Declarative HTML Forms layer (W3C WebMCP `declarative-api-explainer.md`
 * & Chrome's `webmcp-declarative.js`).
 *
 * Layers cleanly on top of `document.modelContext`:
 * - `<form toolname="..." tooldescription="...">` is automatically registered as a tool.
 * - `toolparamdescription` (or associated `<label>`) feeds property descriptions.
 * - `input[type="hidden"]` is excluded so CSRF tokens & internal state never leak.
 * - `toolautosubmit` dispatches a `submit` event with `agentInvoked = true` and `respondWith()`.
 * - Applies `.tool-form-active` and `.tool-submit-active` while a form tool is active.
 */

import type { JsonSchema, ToolExecuteCallbackOptions } from "../types";

export interface DeclarativeSubmitEvent extends Event {
  readonly agentInvoked: boolean;
  respondWith(value: unknown | Promise<unknown>): void;
}

export interface DeclarativeFormsOptions {
  /** Root node to scan & observe (defaults to `document`). */
  root?: ParentNode;
  /** Document providing `modelContext` (defaults to `globalThis.document`). */
  doc?: Document;
  /** Timeout in ms when waiting for a manual user submit (default: 60_000). */
  manualSubmitTimeoutMs?: number;
}

export interface DeclarativeFormsController {
  /** Re-scan forms synchronously (useful after programmatic attribute edits). */
  sync(): void;
  /** Stop observing and unregister all declarative form tools. */
  disconnect(): void;
}

const FORM_ACTIVE_CLASS = "tool-form-active";
const SUBMIT_ACTIVE_CLASS = "tool-submit-active";

function findLabelText(form: HTMLFormElement, el: Element): string | undefined {
  const id = el.getAttribute("id");
  if (id) {
    const escaped =
      typeof CSS !== "undefined" && typeof CSS.escape === "function"
        ? CSS.escape(id)
        : id.replace(/["\\]/g, "\\$&");
    const label = form.querySelector(`label[for="${escaped}"]`);
    const text = label?.textContent?.trim();
    if (text) return text;
  }
  const parentLabel = el.closest("label");
  const text = parentLabel?.textContent?.trim();
  return text || undefined;
}

/**
 * Deterministically synthesize a JSON Schema from a declarative `<form>`.
 * Skips `input[type="hidden"]` so CSRF tokens and internal fields are not exposed.
 */
export function experimental_buildFormInputSchema(form: HTMLFormElement): JsonSchema {
  const properties: Record<string, Record<string, unknown>> = {};
  const required = new Set<string>();
  const radioGroups = new Map<string, { values: string[]; description?: string; required: boolean }>();

  const controls = form.querySelectorAll(
    'input[name]:not([type="hidden"]), select[name], textarea[name]',
  );

  for (const control of Array.from(controls)) {
    const name = control.getAttribute("name")?.trim();
    if (!name) continue;

    const description =
      control.getAttribute("toolparamdescription")?.trim() || findLabelText(form, control);
    const isRequired = control.hasAttribute("required");
    const tag = control.tagName.toUpperCase();

    if (tag === "INPUT") {
      const inputType = (control.getAttribute("type") ?? "text").toLowerCase();
      if (inputType === "submit" || inputType === "button" || inputType === "reset") {
        continue;
      }
      if (inputType === "radio") {
        const existing = radioGroups.get(name) ?? {
          values: [],
          description,
          required: false,
        };
        const val = control.getAttribute("value");
        if (val) existing.values.push(val);
        if (description && !existing.description) existing.description = description;
        if (isRequired) existing.required = true;
        radioGroups.set(name, existing);
        continue;
      }

      const prop: Record<string, unknown> = {
        type:
          inputType === "checkbox"
            ? "boolean"
            : inputType === "number" || inputType === "range"
              ? "number"
              : "string",
      };
      if (description) prop.description = description;
      properties[name] = prop;
      if (isRequired) required.add(name);
    } else if (tag === "SELECT") {
      const options = Array.from(control.querySelectorAll("option"))
        .map((opt) => opt.getAttribute("value") ?? opt.textContent?.trim() ?? "")
        .filter(Boolean);
      const prop: Record<string, unknown> = { type: "string" };
      if (options.length > 0) prop.enum = options;
      if (description) prop.description = description;
      properties[name] = prop;
      if (isRequired) required.add(name);
    } else if (tag === "TEXTAREA") {
      const prop: Record<string, unknown> = { type: "string" };
      if (description) prop.description = description;
      properties[name] = prop;
      if (isRequired) required.add(name);
    }
  }

  for (const [name, group] of radioGroups) {
    const prop: Record<string, unknown> = { type: "string" };
    if (group.values.length > 0) prop.enum = group.values;
    if (group.description) prop.description = group.description;
    properties[name] = prop;
    if (group.required) required.add(name);
  }

  const schema: JsonSchema = {
    type: "object",
    properties,
  };
  if (required.size > 0) {
    schema.required = Array.from(required);
  }
  return schema;
}

function realmEventCtor(form: HTMLFormElement): typeof Event {
  return form.ownerDocument?.defaultView?.Event ?? Event;
}

function populateForm(form: HTMLFormElement, args: Record<string, unknown>): void {
  const EventCtor = realmEventCtor(form);
  const controls = form.querySelectorAll(
    'input[name]:not([type="hidden"]), select[name], textarea[name]',
  );

  for (const control of Array.from(controls)) {
    const name = control.getAttribute("name")?.trim();
    if (!name || !(name in args)) continue;
    const raw = args[name];
    const tag = control.tagName.toUpperCase();

    if (tag === "INPUT") {
      const input = control as HTMLInputElement;
      const type = (input.type || "text").toLowerCase();
      if (type === "checkbox") {
        input.checked = Boolean(raw);
      } else if (type === "radio") {
        input.checked = input.value === String(raw);
      } else {
        input.value = raw == null ? "" : String(raw);
      }
      input.dispatchEvent(new EventCtor("input", { bubbles: true }));
      input.dispatchEvent(new EventCtor("change", { bubbles: true }));
    } else if (tag === "SELECT") {
      const select = control as HTMLSelectElement;
      select.value = raw == null ? "" : String(raw);
      select.dispatchEvent(new EventCtor("change", { bubbles: true }));
    } else if (tag === "TEXTAREA") {
      const textarea = control as HTMLTextAreaElement;
      textarea.value = raw == null ? "" : String(raw);
      textarea.dispatchEvent(new EventCtor("input", { bubbles: true }));
      textarea.dispatchEvent(new EventCtor("change", { bubbles: true }));
    }
  }
}

function createAgentSubmitEvent(
  form: HTMLFormElement,
  onRespond: (value: unknown | Promise<unknown>) => void,
): DeclarativeSubmitEvent {
  const EventCtor = realmEventCtor(form);
  const ev = new EventCtor("submit", { bubbles: true, cancelable: true }) as DeclarativeSubmitEvent;
  Object.defineProperty(ev, "agentInvoked", { value: true, enumerable: true });
  Object.defineProperty(ev, "respondWith", {
    value: (value: unknown | Promise<unknown>) => onRespond(value),
  });
  return ev;
}

/**
 * Enable experimental declarative `<form toolname tooldescription>` registration on `document.modelContext`.
 */
export function experimental_enableDeclarativeForms(
  options: DeclarativeFormsOptions = {},
): DeclarativeFormsController {
  const doc = options.doc ?? (typeof document !== "undefined" ? document : undefined);
  const root = options.root ?? doc;
  const manualTimeout = options.manualSubmitTimeoutMs ?? 60_000;

  const registrations = new Map<
    HTMLFormElement,
    { name: string; signature: string; controller: AbortController }
  >();

  const registerForm = (form: HTMLFormElement) => {
    const mc = doc?.modelContext;
    if (!mc) return;

    const name = form.getAttribute("toolname")?.trim();
    const description = form.getAttribute("tooldescription")?.trim();
    if (!name || !description) {
      const prev = registrations.get(form);
      if (prev) {
        prev.controller.abort();
        registrations.delete(form);
      }
      return;
    }

    const inputSchema = experimental_buildFormInputSchema(form);
    const autoSubmit = form.hasAttribute("toolautosubmit");
    const signature = JSON.stringify({ name, description, autoSubmit, inputSchema });
    const existing = registrations.get(form);
    if (existing?.signature === signature) return;

    if (existing) {
      existing.controller.abort();
      registrations.delete(form);
    }

    const controller = new AbortController();
    registrations.set(form, { name, signature, controller });

    mc.registerTool(
      {
        name,
        description,
        inputSchema,
        execute: async (
          args: Record<string, unknown>,
          execOptions?: ToolExecuteCallbackOptions,
        ) => {
          const submitBtn = form.querySelector<HTMLElement>(
            'button[type="submit"], button:not([type]), input[type="submit"]',
          );
          form.classList.add(FORM_ACTIVE_CLASS);
          submitBtn?.classList.add(SUBMIT_ACTIVE_CLASS);

          try {
            populateForm(form, args);

            let responded = false;
            let responsePromise: Promise<unknown> | undefined;
            const captureResponse = (val: unknown | Promise<unknown>) => {
              responded = true;
              responsePromise = Promise.resolve(val);
            };

            if (autoSubmit) {
              const ev = createAgentSubmitEvent(form, captureResponse);
              form.dispatchEvent(ev);
              if (responded && responsePromise) {
                return await responsePromise;
              }
              return { submitted: true, form: name, values: args };
            }

            // Manual submit mode: focus submit button and wait for user submission or abort.
            submitBtn?.focus?.();
            return await new Promise<unknown>((resolve, reject) => {
              const cleanup = () => {
                clearTimeout(timer);
                form.removeEventListener("submit", onManualSubmit);
                execOptions?.signal?.removeEventListener("abort", onAbort);
              };
              const onAbort = () => {
                cleanup();
                reject(execOptions?.signal?.reason ?? new DOMException("Aborted", "AbortError"));
              };
              const onManualSubmit = (ev: Event) => {
                if (!("respondWith" in ev)) {
                  Object.defineProperty(ev, "agentInvoked", { value: true, enumerable: true });
                  Object.defineProperty(ev, "respondWith", { value: captureResponse });
                }
                cleanup();
                queueMicrotask(() => {
                  if (responded && responsePromise) {
                    responsePromise.then(resolve, reject);
                  } else {
                    resolve({ submitted: true, form: name, values: args });
                  }
                });
              };
              const timer = setTimeout(() => {
                cleanup();
                reject(new DOMException("Timed out waiting for user form submission", "AbortError"));
              }, manualTimeout);

              execOptions?.signal?.addEventListener("abort", onAbort, { once: true });
              form.addEventListener("submit", onManualSubmit, { once: true });
            });
          } finally {
            form.classList.remove(FORM_ACTIVE_CLASS);
            submitBtn?.classList.remove(SUBMIT_ACTIVE_CLASS);
          }
        },
      },
      { signal: controller.signal },
    ).catch(() => {});
  };

  const sync = () => {
    if (!root) return;
    const currentForms = new Set<HTMLFormElement>(
      Array.from(root.querySelectorAll<HTMLFormElement>("form[toolname]")),
    );
    for (const [form, entry] of registrations) {
      if (!currentForms.has(form)) {
        entry.controller.abort();
        registrations.delete(form);
      }
    }
    for (const form of currentForms) {
      registerForm(form);
    }
  };

  sync();

  let observer: MutationObserver | null = null;
  if (typeof MutationObserver !== "undefined" && root && "nodeType" in root) {
    observer = new MutationObserver(() => sync());
    observer.observe(root as Node, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["toolname", "tooldescription", "toolautosubmit", "toolparamdescription", "name", "required"],
    });
  }

  return {
    sync,
    disconnect() {
      observer?.disconnect();
      observer = null;
      for (const entry of registrations.values()) {
        entry.controller.abort();
      }
      registrations.clear();
    },
  };
}
