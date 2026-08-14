import { createRequire } from "node:module";
import { PostHog } from "posthog-node";
import { SeverityNumber, type Logger as OtelLogger } from "@opentelemetry/api-logs";
import {
  BatchLogRecordProcessor,
  LoggerProvider,
} from "@opentelemetry/sdk-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";

// Telemetry is opt-in via POSTHOG_PROJECT_TOKEN so self-hosted servers never
// phone home. Structured JSON lines keep going to stdout/stderr either way.
const token = process.env.POSTHOG_PROJECT_TOKEN?.trim() ?? "";
const host = (
  process.env.POSTHOG_HOST?.trim() || "https://us.i.posthog.com"
).replace(/\/+$/, "");
const environment =
  process.env.DAHOKO_ENV?.trim() || process.env.NODE_ENV?.trim() || "production";
const serviceVersion = (
  createRequire(import.meta.url)("../package.json") as { version: string }
).version;

/** Error tracking client; null when telemetry is off. */
export const posthog: PostHog | null = token
  ? new PostHog(token, { host, enableExceptionAutocapture: true })
  : null;

let loggerProvider: LoggerProvider | null = null;
let otelLogger: OtelLogger | null = null;
if (token) {
  loggerProvider = new LoggerProvider({
    resource: resourceFromAttributes({
      "service.name": "dahoko-sync-server",
      "service.version": serviceVersion,
      "deployment.environment": environment,
    }),
    processors: [
      new BatchLogRecordProcessor({
        exporter: new OTLPLogExporter({
          url: `${host}/i/v1/logs`,
          headers: { Authorization: `Bearer ${token}` },
        }),
      }),
    ],
  });
  otelLogger = loggerProvider.getLogger("dahoko-sync-server");
}

type LogAttrs = Record<string, unknown>;
type Level = "debug" | "info" | "warn" | "error";

const SEVERITY: Record<Level, SeverityNumber> = {
  debug: SeverityNumber.DEBUG,
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
};
const ORDER: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const minLevel: Level =
  process.env.DAHOKO_LOG_LEVEL === "debug" ? "debug" : "info";

/** OTel attributes only take primitives; everything else is stringified. */
function flattenAttrs(
  attrs: LogAttrs,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null) continue;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      out[key] = value;
    } else {
      try {
        out[key] = JSON.stringify(value).slice(0, 2_000);
      } catch {
        out[key] = String(value);
      }
    }
  }
  return out;
}

function errorAttrs(error: unknown): LogAttrs {
  if (error === undefined) return {};
  if (error instanceof Error) {
    return { errorName: error.name, errorMessage: error.message };
  }
  return { errorValue: String(error) };
}

function write(
  level: Level,
  event: string,
  attrs?: LogAttrs,
  error?: unknown,
): void {
  if (ORDER[level] < ORDER[minLevel]) return;
  const fields = { ...attrs, ...errorAttrs(error) };
  const line = JSON.stringify({ level, event, ...fields });
  if (level === "error" || level === "warn") console.error(line);
  else console.log(line);

  otelLogger?.emit({
    severityNumber: SEVERITY[level],
    severityText: level.toUpperCase(),
    body: event,
    attributes: flattenAttrs(fields),
  });
  if (level === "error" && error !== undefined && posthog) {
    posthog.captureException(
      error instanceof Error ? error : new Error(String(error)),
      undefined,
      { log_event: event, ...flattenAttrs(attrs ?? {}) },
    );
  }
}

/** Structured logger: JSON lines to stdout/stderr always; PostHog Logs when
 * configured. `error` with an Error value also reports to error tracking. */
export const log = {
  debug: (event: string, attrs?: LogAttrs) => write("debug", event, attrs),
  info: (event: string, attrs?: LogAttrs) => write("info", event, attrs),
  warn: (event: string, attrs?: LogAttrs) => write("warn", event, attrs),
  error: (event: string, error?: unknown, attrs?: LogAttrs) =>
    write("error", event, attrs, error),
};

/** Flush buffered events and log records; call once during shutdown. */
export async function shutdownTelemetry(): Promise<void> {
  await Promise.allSettled([
    posthog?.shutdown() ?? Promise.resolve(),
    loggerProvider?.shutdown() ?? Promise.resolve(),
  ]);
}
