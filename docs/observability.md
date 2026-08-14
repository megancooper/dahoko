# Observability

Error tracking and structured logs ship to PostHog from every surface.
Telemetry is **strictly opt-in per build**: when `POSTHOG_PROJECT_TOKEN` is
absent at build/start time, every code path degrades to plain console/stdout
logging and nothing ever leaves the machine. Self-hosted sync servers and
locally built apps are silent by default.

| Surface     | SDK                        | `service.name`      | Errors                                     | Logs                        |
| ----------- | -------------------------- | ------------------- | ------------------------------------------ | --------------------------- |
| desktop     | posthog-js + @posthog/react| `dahoko-desktop`    | autocapture + router boundary + `log.error`| `src/lib/log.ts`            |
| sync-server | posthog-node + OTel        | `dahoko-sync-server`| autocapture + 500 handler + `log.error`    | `src/telemetry.ts`          |
| www         | posthog-js                 | —                   | autocapture + React 19 root hook + 5xx API | errors only                 |
| android     | posthog-android 3.58.2     | `dahoko-android`    | `errorTrackingConfig.autoCapture` + AppLog | `Telemetry.kt` (`AppLog`)   |

## Environment variables

| Variable                | What                                                        | Where |
| ----------------------- | ----------------------------------------------------------- | ----- |
| `POSTHOG_PROJECT_TOKEN` | `phc_…` ingestion token; safe to embed in client bundles    | Infisical (all envs); GitHub secret for CI |
| `POSTHOG_PROJECT_ID`    | Numeric project id; only used for sourcemap uploads         | Infisical; GitHub secret |
| `POSTHOG_HOST`          | Optional; defaults to `https://us.i.posthog.com` (set `https://eu.i.posthog.com` for EU) | Infisical; GitHub repo var |
| `POSTHOG_CLI_TOKEN`     | `phx_…` **personal API key** with error-tracking write scope; CI-only, powers sourcemap uploads. Never reaches any bundle. | GitHub secret |
| `DAHOKO_ENV`            | sync-server `deployment.environment` attribute (default `production`) | deploy env |
| `DAHOKO_LOG_LEVEL`      | sync-server; `debug` also emits per-request events for 2xx  | deploy env |

The Vite apps inline exactly `POSTHOG_PROJECT_TOKEN` and `POSTHOG_HOST` via an
explicit `define` block (see `vite.config.ts`) — deliberately not an
`envPrefix`, so `POSTHOG_CLI_TOKEN` can never leak into a bundle. Android
bakes the same two values into `BuildConfig` from env vars or the
`posthogProjectToken` / `posthogHost` Gradle properties.

## Local development

Plain `pnpm dev` runs with telemetry off. To exercise the real pipeline:

```bash
infisical run -- pnpm dev          # desktop + www with telemetry
pnpm dev:sync                      # already wrapped in infisical run
POSTHOG_PROJECT_TOKEN=phc_… ./gradlew installDebug   # android
```

Dev events are tagged `environment: development` (`MODE`/`BuildConfig.DEBUG`),
so they are filterable out of production views.

## What gets captured

- **Exceptions** — uncaught errors and unhandled rejections everywhere;
  desktop adds a TanStack Router error boundary (`route-error.tsx`) and a
  `PostHogErrorBoundary` outer net; www hooks React 19's `onUncaughtError`
  (React 19 no longer rethrows render errors to `window.onerror`).
- **Structured logs** — `createLogger(ns)` on desktop, `log.*` on the
  sync-server, `AppLog` on Android. Info+ ships; debug stays local. Desktop
  log lines double as exception breadcrumbs via `addExceptionStep`, and
  client-side records carry distinct id + session id automatically.
- **Wide request events** — the sync-server emits one `http_request` per
  request (requestId, method, path, status, durationMs): warn for 5xx, info
  for 4xx, debug otherwise.
- **Expected-vs-bug split** — 4xx sync/API rejections log as warnings without
  an exception report; only 5xx/unknown failures create error-tracking issues.

## Privacy

Task content never leaves the device: desktop DOM autocapture and session
recording are off, log attributes carry only ids/statuses/counts, and the
desktop Settings → General → **Crash reports** switch opts a device out
entirely (persisted by the SDK itself). The sync-server identifies events by
the random account UUID at most — never email.

## Sourcemaps

Vite builds emit hidden sourcemaps. `scripts/upload-sourcemaps.mjs` runs at
the end of each web build: with `POSTHOG_CLI_TOKEN` + `POSTHOG_PROJECT_ID` it
injects chunk ids, uploads maps, then deletes them; in CI without a token it
still deletes them so releases and Pages deploys never ship maps; local
builds keep them.

## Follow-ups

- Android release builds are minified; PostHog needs the R8 mapping upload
  (see posthog.com/docs/error-tracking/upload-mappings/android) before
  release stack traces are readable.
- Alerts on new/spiking issues can be added in PostHog (error tracking →
  alerts) once events are flowing.
