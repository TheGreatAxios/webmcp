#!/usr/bin/env bun
import { createMcpBridge } from "./mcp-server";
import { resolveBridgeOptions } from "./security";

async function main() {
  const options = resolveBridgeOptions();
  const token = options.token?.trim();
  if (!token || token.length < 32) {
    throw new Error(
      "WEBMCP_BRIDGE_TOKEN is required and must contain at least 32 characters",
    );
  }
  const bridge = await createMcpBridge({ ...options, token });
  console.error(`[webmcp-bridge] listening on ws://${bridge.host}:${bridge.port}/ws`);
  await bridge.connectStdio();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
