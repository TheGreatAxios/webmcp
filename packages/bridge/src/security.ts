/**
 * Bridge security defaults
 */
export const DEFAULT_HOST = "127.0.0.1";
export const DEFAULT_PORT = 17321;

export interface BridgeSecurityOptions {
  host?: string;
  port?: number;
  /** Random token required on WebSocket handshake */
  token?: string;
  /** Allowed Origin headers (empty = any localhost origin) */
  allowedOrigins?: string[];
}

export function resolveBridgeOptions(
  env: Record<string, string | undefined> = process.env,
): BridgeSecurityOptions {
  const port = Number(env.WEBMCP_BRIDGE_PORT ?? DEFAULT_PORT);
  return {
    host: env.WEBMCP_BRIDGE_HOST ?? DEFAULT_HOST,
    port: Number.isFinite(port) ? port : DEFAULT_PORT,
    token: env.WEBMCP_BRIDGE_TOKEN,
    allowedOrigins: env.WEBMCP_BRIDGE_ORIGINS?.split(",").filter(Boolean),
  };
}

export function generateBridgeToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function isOriginAllowed(origin: string | null, allowed?: string[]): boolean {
  if (!origin) return true;
  if (!allowed || allowed.length === 0) {
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  }
  return allowed.includes(origin);
}
