#!/usr/bin/env bun
/**
 * Workspace modularity & circular dependency checker powered by `skott`.
 * Enforces:
 * 1. Zero circular dependencies across all packages.
 * 2. Strict TS layer boundaries (mirroring `arch-lint` for Rust):
 *    - `core` is leaf (cannot import adapters or bridge)
 *    - framework adapters (`elements`, `react`, `svelte`, `vue`) cannot cross-import each other or `bridge`
 *    - `bridge` cannot import UI framework adapters
 */
import skott from "skott";

const PACKAGES = [
  "packages/core",
  "packages/elements",
  "packages/react",
  "packages/svelte",
  "packages/vue",
  "packages/bridge",
  "packages/webmcp",
] as const;

const FORBIDDEN_IMPORTS: Record<string, readonly string[]> = {
  "packages/core": [
    "@thegreataxios/webmcp-elements",
    "@thegreataxios/webmcp-react",
    "@thegreataxios/webmcp-svelte",
    "@thegreataxios/webmcp-vue",
    "@thegreataxios/webmcp-bridge",
    "@thegreataxios/webmcp",
  ],
  "packages/elements": [
    "@thegreataxios/webmcp-react",
    "@thegreataxios/webmcp-svelte",
    "@thegreataxios/webmcp-vue",
    "@thegreataxios/webmcp-bridge",
    "@thegreataxios/webmcp",
  ],
  "packages/react": [
    "@thegreataxios/webmcp-elements",
    "@thegreataxios/webmcp-svelte",
    "@thegreataxios/webmcp-vue",
    "@thegreataxios/webmcp-bridge",
    "@thegreataxios/webmcp",
  ],
  "packages/svelte": [
    "@thegreataxios/webmcp-elements",
    "@thegreataxios/webmcp-react",
    "@thegreataxios/webmcp-vue",
    "@thegreataxios/webmcp-bridge",
    "@thegreataxios/webmcp",
  ],
  "packages/vue": [
    "@thegreataxios/webmcp-elements",
    "@thegreataxios/webmcp-react",
    "@thegreataxios/webmcp-svelte",
    "@thegreataxios/webmcp-bridge",
    "@thegreataxios/webmcp",
  ],
  "packages/bridge": [
    "@thegreataxios/webmcp-elements",
    "@thegreataxios/webmcp-react",
    "@thegreataxios/webmcp-svelte",
    "@thegreataxios/webmcp-vue",
    "@thegreataxios/webmcp",
  ],
};

let violations = 0;

for (const pkg of PACKAGES) {
  const { useGraph, getStructure } = await skott({
    entrypoint: `${pkg}/src/index.ts`,
    includeBaseDir: false,
    dependencyTracking: {
      thirdParty: true,
      builtin: false,
      typeOnly: true,
    },
    fileExtensions: [".ts", ".tsx"],
    tsConfigPath: `${pkg}/tsconfig.json`,
  });

  const graph = useGraph();
  const circular = graph.findCircularDependencies();
  if (circular.length > 0) {
    violations += circular.length;
    console.error(`[skott] Circular dependency in ${pkg}:`, circular);
  }

  const forbidden = FORBIDDEN_IMPORTS[pkg];
  if (forbidden) {
    const { graph: nodes } = getStructure();
    for (const [file, node] of Object.entries(nodes)) {
      for (const dep of node.body.thirdPartyDependencies) {
        if (forbidden.includes(dep)) {
          violations++;
          console.error(`[skott] Boundary violation in ${pkg}/${file}: forbidden import "${dep}"`);
        }
      }
    }
  }
}

if (violations > 0) {
  console.error(`skott: FAILED — ${violations} modularity violation(s)`);
  process.exit(1);
}

console.log(`skott: OK (${PACKAGES.length} packages verified — 0 circular deps, 0 boundary violations)`);
