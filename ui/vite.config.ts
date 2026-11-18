import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  envPrefix: ["VITE_", "TAURI_ENV_PLATFORM"],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "jsdom",
    setupFiles: [fileURLToPath(new URL("./src/testSetup.ts", import.meta.url))],
  },
  server: { port: 1420, strictPort: true },
});
