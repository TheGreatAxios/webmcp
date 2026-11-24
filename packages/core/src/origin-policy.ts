/**
 * W3C WebMCP Section 6.3.4 two-sided cross-origin tool visibility policy.
 * Mirrors `crates/webmcp-policy/src/origin.rs`.
 */

export function isToolVisibleToCaller(
  callerOrigin: string,
  toolOrigin: string,
  exposedTo: readonly string[],
  fromOrigins?: readonly string[],
): boolean {
  const callerWants =
    fromOrigins === undefined
      ? callerOrigin === toolOrigin
      : fromOrigins.some((o) => o === "*" || o === toolOrigin);

  if (!callerWants) return false;
  if (callerOrigin === toolOrigin) return true;
  return exposedTo.some((o) => o === "*" || o === callerOrigin);
}
