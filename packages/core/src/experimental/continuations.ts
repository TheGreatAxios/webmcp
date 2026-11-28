/**
 * Experimental Continuation Tokens (W3C WebMCP `continuations-explainer.md`).
 *
 * Allows an imperative tool invocation to request a one-time RFC 9562 v4 UUID
 * continuation token (`options.invocation.requestToken()`) and redeem it on a
 * subsequent document or iframe via `experimental_resumeTool(token, callback)`.
 */

export interface ExperimentalModelContextToolInvocation {
  requestToken(): Promise<string>;
}

export interface ContinuationHandle {
  readonly invocation: ExperimentalModelContextToolInvocation;
  settle(): void;
}

export interface ContinuationManager {
  createInvocation(signal: AbortSignal, isResumed?: boolean): ContinuationHandle;
  hasToken(token: string): boolean;
  resumeTool<T = unknown>(
    token: string,
    callback: (options: {
      signal: AbortSignal;
      invocation: ExperimentalModelContextToolInvocation;
    }) => T | Promise<T>,
    options?: { signal?: AbortSignal },
  ): Promise<T>;
  clear(): void;
}

export function experimental_createContinuationManager(): ContinuationManager {
  const activeTokens = new Set<string>();

  return {
    createInvocation(signal: AbortSignal, isResumed = false): ContinuationHandle {
      let settled = false;
      let requested = false;

      const invocation: ExperimentalModelContextToolInvocation = {
        async requestToken(): Promise<string> {
          if (isResumed) {
            throw new DOMException(
              "Cannot request a continuation token inside resumeTool()",
              "InvalidStateError",
            );
          }
          if (settled || signal.aborted) {
            throw new DOMException(
              "Cannot request a continuation token after invocation settled or was cancelled",
              "InvalidStateError",
            );
          }
          if (requested) {
            throw new DOMException(
              "A continuation token was already requested for this invocation",
              "InvalidStateError",
            );
          }
          requested = true;
          const token = crypto.randomUUID();
          activeTokens.add(token);
          return token;
        },
      };

      return {
        invocation,
        settle() {
          settled = true;
        },
      };
    },

    hasToken(token: string): boolean {
      return activeTokens.has(token);
    },

    async resumeTool<T = unknown>(
      token: string,
      callback: (options: {
        signal: AbortSignal;
        invocation: ExperimentalModelContextToolInvocation;
      }) => T | Promise<T>,
      options?: { signal?: AbortSignal },
    ): Promise<T> {
      if (!activeTokens.delete(token)) {
        throw new DOMException(
          `Continuation token "${token}" is invalid or already redeemed`,
          "NotFoundError",
        );
      }
      if (options?.signal?.aborted) {
        throw options.signal.reason ?? new DOMException("Aborted", "AbortError");
      }

      const controller = new AbortController();
      const onAbort = () => controller.abort(options?.signal?.reason);
      options?.signal?.addEventListener("abort", onAbort, { once: true });

      const handle = this.createInvocation(controller.signal, true);
      try {
        return await callback({
          signal: controller.signal,
          invocation: handle.invocation,
        });
      } finally {
        handle.settle();
        options?.signal?.removeEventListener("abort", onAbort);
      }
    },

    clear(): void {
      activeTokens.clear();
    },
  };
}
