import { describe, expect, test } from "bun:test";
import { installPolyfill } from "../index";
import { WebMCPProvider } from "../react";
import { createMcpBridge } from "../bridge";

describe("@thegreataxios/webmcp umbrella", () => {
  test("re-exports core", () => {
    expect(typeof installPolyfill).toBe("function");
  });

  test("re-exports react", () => {
    expect(typeof WebMCPProvider).toBe("function");
  });

  test("re-exports bridge", () => {
    expect(typeof createMcpBridge).toBe("function");
  });
});
