import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/elements-entry.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
});
