import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import { defineConfig, loadEnv } from "vite";
import pkg from "./package.json";

// Tauri expects a fixed dev port; 5103 is also usable directly in a browser
// (the app falls back to an in-memory database outside Tauri).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [TanStackRouterVite({ autoCodeSplitting: true }), react()],
    clearScreen: false,
    // Only these exact values reach the client bundle; a broad envPrefix
    // would also inline unrelated POSTHOG_* secrets (e.g. a CI CLI token).
    define: {
      "import.meta.env.POSTHOG_PROJECT_TOKEN": JSON.stringify(
        env.POSTHOG_PROJECT_TOKEN ?? "",
      ),
      "import.meta.env.POSTHOG_HOST": JSON.stringify(
        env.POSTHOG_HOST ?? "https://us.i.posthog.com",
      ),
      "import.meta.env.APP_VERSION": JSON.stringify(pkg.version),
    },
    build: {
      // Maps stay unreferenced from the bundle; scripts/upload-sourcemaps.mjs
      // ships them to PostHog in CI and strips them before Tauri bundling.
      sourcemap: "hidden" as const,
    },
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
  };
});
