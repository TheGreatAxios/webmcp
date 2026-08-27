import type { JsonSchema, ToolDescriptor } from "./types";

const TOOL_NAME_RE = /^[A-Za-z0-9_.-]+$/;
const MAX_NAME_LEN = 128;

export function assertToolName(name: string): void {
  if (!name || name.length > MAX_NAME_LEN || !TOOL_NAME_RE.test(name)) {
    throw new DOMException(
      `Invalid tool name "${name}". Must be 1–128 chars matching ${TOOL_NAME_RE.source}`,
      "SyntaxError",
    );
  }
}

export function assertToolDescription(description: string): void {
  if (!description || description.trim().length === 0) {
    throw new DOMException("Tool description is required", "SyntaxError");
  }
}

export function assertSerializableJson(value: unknown, label: string): void {
  try {
    JSON.stringify(value);
  } catch {
    throw new DOMException(`${label} must be JSON-serializable`, "SyntaxError");
  }
}

export function assertInputSchema(schema: JsonSchema | undefined): void {
  if (schema !== undefined) {
    assertSerializableJson(schema, "inputSchema");
  }
}

export function assertExposedToOrigins(origins: string[] | undefined): void {
  if (!origins) return;
  for (const origin of origins) {
    try {
      const url = new URL(origin);
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        throw new Error("bad protocol");
      }
    } catch {
      throw new DOMException(`Invalid exposedTo origin: ${origin}`, "SyntaxError");
    }
  }
}

export function validateToolDescriptor(descriptor: ToolDescriptor): void {
  if (typeof descriptor.execute !== "function") {
    throw new TypeError("Tool execute must be a function");
  }
  assertToolName(descriptor.name);
  assertToolDescription(descriptor.description);
  assertInputSchema(descriptor.inputSchema);
  if (descriptor.outputSchema !== undefined) {
    assertSerializableJson(descriptor.outputSchema, "outputSchema");
  }
  if (descriptor.annotations !== undefined) {
    assertSerializableJson(descriptor.annotations, "annotations");
  }
}

export function parseToolArgsJson(inputArgsJson: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(inputArgsJson);
  } catch {
    throw new DOMException("Invalid JSON input", "OperationError");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new DOMException("Input must be a JSON object", "OperationError");
  }
  return parsed as Record<string, unknown>;
}
