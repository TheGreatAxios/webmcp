#!/usr/bin/env node
import { createMcpBridge } from "./mcp-server";

async function main() {
  const bridge = await createMcpBridge();
  console.error(`[webmcp-bridge] ws://127.0.0.1:${bridge.port}/ws token=${bridge.token}`);
  await bridge.connectStdio();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
