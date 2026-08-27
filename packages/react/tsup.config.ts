import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  banner: { js: '"use client";' },
  external: ["react", "react-dom", "@thegreataxios/webmcp-core"],
});
