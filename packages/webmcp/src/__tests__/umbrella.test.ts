import { describe, expect, test } from "bun:test";
import { installPolyfill } from "../index";
import { registerWebMCPElements } from "../elements";
import { WebMCPProvider } from "../react";
import { createWebMCPProvider } from "../svelte";
import { createWebMCPPlugin } from "../vue";
import { createMcpBridge } from "../bridge";

describe("@thegreataxios/webmcp umbrella", () => {
  test("re-exports core", () => {
    expect(typeof installPolyfill).toBe("function");
  });

  test("re-exports elements", () => {
    expect(typeof registerWebMCPElements).toBe("function");
  });

  test("re-exports react", () => {
    expect(typeof WebMCPProvider).toBe("function");
  });

  test("re-exports svelte", () => {
    expect(typeof createWebMCPProvider).toBe("function");
  });

  test("re-exports vue", () => {
    expect(typeof createWebMCPPlugin).toBe("function");
  });

  test("re-exports bridge", () => {
    expect(typeof createMcpBridge).toBe("function");
  });
});
