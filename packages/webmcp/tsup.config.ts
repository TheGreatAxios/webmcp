import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/react.ts", "src/bridge.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  external: [
    "@thegreataxios/webmcp-core",
    "@thegreataxios/webmcp-react",
    "@thegreataxios/webmcp-bridge",
    "react",
    "react-dom",
  ],
});
