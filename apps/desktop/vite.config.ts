import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import { defineConfig } from "vite";

// Tauri expects a fixed dev port; 5103 is also usable directly in a browser
// (the app falls back to an in-memory database outside Tauri).
export default defineConfig({
  plugins: [TanStackRouterVite({ autoCodeSplitting: true }), react()],
  clearScreen: false,
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  server: {
    host: true,
    // PORT override lets a second dev server run alongside the default;
    // Tauri always launches without PORT and gets the fixed 5103.
    port: Number(process.env.PORT) || 5103,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
