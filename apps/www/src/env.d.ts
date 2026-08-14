/** Build-time constants injected by the `define` block in vite.config.ts. */
interface ImportMetaEnv {
  /** PostHog ingestion token (phc_…); telemetry is disabled when empty. */
  readonly POSTHOG_PROJECT_TOKEN: string;
  readonly POSTHOG_HOST: string;
}
