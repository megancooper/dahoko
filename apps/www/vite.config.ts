import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    // Only these exact values reach the client bundle; a broad envPrefix
    // would also inline unrelated POSTHOG_* secrets (e.g. a CI CLI token).
    define: {
      "import.meta.env.POSTHOG_PROJECT_TOKEN": JSON.stringify(
        env.POSTHOG_PROJECT_TOKEN ?? "",
      ),
      "import.meta.env.POSTHOG_HOST": JSON.stringify(
        env.POSTHOG_HOST ?? "https://us.i.posthog.com",
      ),
    },
    build: {
      // Maps stay unreferenced from the bundle; scripts/upload-sourcemaps.mjs
      // ships them to PostHog and strips them before the Pages deploy.
      sourcemap: "hidden" as const,
    },
    server: {
      host: true,
      port: 5102,
      strictPort: true,
    },
  };
});
