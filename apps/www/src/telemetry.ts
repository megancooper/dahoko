import posthog from "posthog-js";

// Values are inlined at build time by the `define` block in vite.config.ts.
// Builds without a token (e.g. local dev) never talk to PostHog.
const PROJECT_TOKEN = import.meta.env.POSTHOG_PROJECT_TOKEN;
const HOST = import.meta.env.POSTHOG_HOST;

export const telemetryAvailable = Boolean(PROJECT_TOKEN);

let initialized = false;

export function initTelemetry(): void {
  if (!telemetryAvailable || initialized) return;
  initialized = true;
  posthog.init(PROJECT_TOKEN, {
    api_host: HOST,
    defaults: "2026-05-30",
    capture_exceptions: true,
  });
  posthog.register({ surface: "www" });
}

/** Report a caught exception; drops silently when telemetry is off. */
export function reportError(
  error: unknown,
  properties?: Record<string, unknown>,
): void {
  if (!initialized) return;
  posthog.captureException(error, properties);
}
