import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 43115,
    strictPort: true,
  },
  preview: {
    port: 43115,
    strictPort: true,
  },
});
