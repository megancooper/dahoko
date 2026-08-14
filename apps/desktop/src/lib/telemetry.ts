import posthog from "posthog-js";

// Values are inlined at build time by the `define` block in vite.config.ts.
// Without a token (e.g. a plain `pnpm dev` outside `infisical run`) every
// helper below is a no-op and the app never talks to PostHog.
const PROJECT_TOKEN = import.meta.env.POSTHOG_PROJECT_TOKEN;
const HOST = import.meta.env.POSTHOG_HOST;
const APP_VERSION = import.meta.env.APP_VERSION;

export const telemetryAvailable = Boolean(PROJECT_TOKEN);

let initialized = false;

export function initTelemetry(): void {
  if (!telemetryAvailable || initialized) return;
  initialized = true;
  posthog.init(PROJECT_TOKEN, {
    api_host: HOST,
    defaults: "2026-05-30",
    // The webview renders user task content everywhere; DOM autocapture and
    // session recording would ship that content with events, so both stay off.
    autocapture: false,
    disable_session_recording: true,
    capture_exceptions: true,
    persistence: "localStorage",
    logs: {
      serviceName: "dahoko-desktop",
      environment: import.meta.env.MODE,
      serviceVersion: APP_VERSION,
    },
  });
  posthog.register({
    app_version: APP_VERSION,
    surface: "desktop",
  });
}

/** Applies the "Crash reports" setting; the choice persists inside PostHog's
 * own storage, so an opt-out is honored on the next launch before settings
 * load. */
export function setDiagnosticsEnabled(enabled: boolean): void {
  if (!telemetryAvailable || !initialized) return;
  if (enabled) {
    if (posthog.has_opted_out_capturing()) posthog.opt_in_capturing();
  } else if (!posthog.has_opted_out_capturing()) {
    posthog.opt_out_capturing();
  }
}

export function telemetryActive(): boolean {
  return (
    telemetryAvailable && initialized && !posthog.has_opted_out_capturing()
  );
}

/** Report a caught exception with its stack and any recorded exception steps.
 * Safe to call unconditionally; drops silently when telemetry is off. */
export function reportError(
  error: unknown,
  properties?: Record<string, unknown>,
): void {
  if (!telemetryActive()) return;
  posthog.captureException(error, properties);
}
