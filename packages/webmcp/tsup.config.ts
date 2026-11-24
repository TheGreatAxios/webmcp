import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/react.ts",
    "src/bridge.ts",
    "src/elements.ts",
    "src/svelte.ts",
    "src/vue.ts",
  ],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  external: [
    "@thegreataxios/webmcp-core",
    "@thegreataxios/webmcp-elements",
    "@thegreataxios/webmcp-svelte",
    "@thegreataxios/webmcp-vue",
    "@thegreataxios/webmcp-react",
    "@thegreataxios/webmcp-bridge",
    "react",
    "react-dom",
    "svelte",
    "svelte/store",
    "vue",
  ],
});
