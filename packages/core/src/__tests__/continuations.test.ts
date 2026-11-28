import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  cleanupPolyfill,
  experimental_createContinuationManager,
  experimental_getContinuationManager,
  installPolyfill,
} from "../index";

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

beforeEach(() => {
  cleanupPolyfill();
  experimental_getContinuationManager().clear();
});

afterEach(() => {
  cleanupPolyfill();
  experimental_getContinuationManager().clear();
});

describe("experimental continuation tokens (Blink continuations-explainer)", () => {
  test("issues one RFC 9562 v4 UUID per invocation and redeems once via resumeTool", async () => {
    installPolyfill();
    let capturedToken = "";

    await document.modelContext!.registerTool({
      name: "checkout_step1",
      description: "Starts multi-page checkout",
      execute: async (_args, options) => {
        capturedToken = await options!.invocation!.requestToken();
        return { nextUrl: "/billing", token: capturedToken };
      },
    });

    const [tool] = await document.modelContext!.getTools();
    await document.modelContext!.executeTool(tool, {});
    expect(capturedToken).toMatch(UUID_V4_RE);

    const mgr = experimental_getContinuationManager();
    expect(mgr.hasToken(capturedToken)).toBe(true);

    const resumed = await mgr.resumeTool(capturedToken, async ({ invocation }) => {
      // Spec invariant: cannot call requestToken() inside resumeTool()
      await expect(invocation.requestToken()).rejects.toThrow(/resumeTool/);
      return { orderId: "ORD-99" };
    });

    expect(resumed).toEqual({ orderId: "ORD-99" });
    expect(mgr.hasToken(capturedToken)).toBe(false);

    // One-time redemption: reusing the token fails with NotFoundError
    try {
      await mgr.resumeTool(capturedToken, async () => ({}));
      expect.unreachable("should throw");
    } catch (err) {
      expect(err).toBeInstanceOf(DOMException);
      expect((err as DOMException).name).toBe("NotFoundError");
    }
  });

  test("enforces InvalidStateError on duplicate, post-settle, and aborted requestToken calls", async () => {
    const mgr = experimental_createContinuationManager();

    // Duplicate request
    const c1 = new AbortController();
    const h1 = mgr.createInvocation(c1.signal);
    const tok = await h1.invocation.requestToken();
    expect(tok).toMatch(UUID_V4_RE);
    await expect(h1.invocation.requestToken()).rejects.toThrow(/already requested/);

    // Post-settle request
    const c2 = new AbortController();
    const h2 = mgr.createInvocation(c2.signal);
    h2.settle();
    await expect(h2.invocation.requestToken()).rejects.toThrow(/settled or was cancelled/);

    // Aborted request
    const c3 = new AbortController();
    const h3 = mgr.createInvocation(c3.signal);
    c3.abort();
    await expect(h3.invocation.requestToken()).rejects.toThrow(/settled or was cancelled/);
  });
});
