/**
 * W3C WebMCP `ToolActivatedEvent` and `ToolCancelEvent` classes.
 */

export class WebMCPToolActivatedEvent extends Event {
  readonly toolName: string;

  constructor(type: string, eventInitDict?: { toolName?: string } & EventInit) {
    super(type, eventInitDict);
    this.toolName = eventInitDict?.toolName ?? "";
  }
}

export class WebMCPToolCancelEvent extends Event {
  readonly toolName: string;

  constructor(type: string, eventInitDict?: { toolName?: string } & EventInit) {
    super(type, eventInitDict);
    this.toolName = eventInitDict?.toolName ?? "";
  }
}

export function ensureEventConstructors(): void {
  const g = globalThis as Record<string, unknown>;
  if (typeof g.ToolActivatedEvent === "undefined") {
    g.ToolActivatedEvent = WebMCPToolActivatedEvent;
  }
  if (typeof g.ToolCancelEvent === "undefined") {
    g.ToolCancelEvent = WebMCPToolCancelEvent;
  }
}

export function createToolActivatedEvent(toolName: string): Event {
  ensureEventConstructors();
  const Ctor = (globalThis as Record<string, unknown>).ToolActivatedEvent as typeof WebMCPToolActivatedEvent;
  return new Ctor("toolactivated", { toolName });
}

export function createToolCancelEvent(toolName: string): Event {
  ensureEventConstructors();
  const Ctor = (globalThis as Record<string, unknown>).ToolCancelEvent as typeof WebMCPToolCancelEvent;
  return new Ctor("toolcancel", { toolName });
}
