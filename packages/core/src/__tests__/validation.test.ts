import { describe, expect, test } from "bun:test";
import { assertToolName, parseToolArgsJson, validateToolDescriptor } from "../validation";

describe("assertToolName", () => {
  test("accepts valid names", () => {
    assertToolName("search_products");
    assertToolName("tool.v2");
  });

  test("rejects empty and invalid names", () => {
    expect(() => assertToolName("")).toThrow();
    expect(() => assertToolName("bad name")).toThrow();
    expect(() => assertToolName("a".repeat(129))).toThrow();
  });
});

describe("validateToolDescriptor", () => {
  test("requires execute function", () => {
    expect(() =>
      validateToolDescriptor({
        name: "x",
        description: "d",
        execute: undefined as never,
      }),
    ).toThrow();
  });
});

describe("parseToolArgsJson", () => {
  test("parses object", () => {
    expect(parseToolArgsJson('{"a":1}')).toEqual({ a: 1 });
  });

  test("rejects non-object", () => {
    expect(() => parseToolArgsJson("[]")).toThrow();
  });
});
