import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 43113, strictPort: true, host: true },
  preview: { port: 43113, strictPort: true },
});
