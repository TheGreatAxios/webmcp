import { describe, expect, test } from "bun:test";
import { isOriginAllowed, generateBridgeToken } from "../security";

describe("isOriginAllowed", () => {
  test("allows localhost origins by default", () => {
    expect(isOriginAllowed("http://localhost:3000")).toBe(true);
    expect(isOriginAllowed("http://127.0.0.1:5173")).toBe(true);
  });

  test("rejects remote origins by default", () => {
    expect(isOriginAllowed("https://evil.com")).toBe(false);
  });

  test("respects explicit allowlist", () => {
    expect(isOriginAllowed("https://app.test", ["https://app.test"])).toBe(true);
  });
});

describe("generateBridgeToken", () => {
  test("returns hex string", () => {
    const token = generateBridgeToken();
    expect(token.length).toBe(64);
    expect(token).toMatch(/^[0-9a-f]+$/);
  });
});
