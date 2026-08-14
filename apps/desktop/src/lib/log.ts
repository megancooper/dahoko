import posthog from "posthog-js";
import { reportError, telemetryActive } from "./telemetry";

type LogLevel = "debug" | "info" | "warn" | "error";
type LogAttrs = Record<string, unknown>;

export interface Logger {
  debug: (message: string, attrs?: LogAttrs) => void;
  info: (message: string, attrs?: LogAttrs) => void;
  warn: (message: string, attrs?: LogAttrs) => void;
  /** Errors with an `error` value are also reported to error tracking. */
  error: (message: string, error?: unknown, attrs?: LogAttrs) => void;
}

const CONSOLE: Record<LogLevel, (...args: unknown[]) => void> = {
  debug: console.debug.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

/** PostHog log attributes only take JSON-safe primitives at the top level. */
function flattenAttrs(attrs: LogAttrs): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null) continue;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      out[key] = value;
    } else if (value instanceof Error) {
      out[key] = `${value.name}: ${value.message}`;
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

function emit(
  namespace: string,
  level: LogLevel,
  message: string,
  attrs?: LogAttrs,
  error?: unknown,
): void {
  const consoleArgs: unknown[] = [`[dahoko:${namespace}]`, message];
  if (attrs && Object.keys(attrs).length > 0) consoleArgs.push(attrs);
  if (error !== undefined) consoleArgs.push(error);
  CONSOLE[level](...consoleArgs);

  if (!telemetryActive()) return;
  const attributes = {
    namespace,
    ...(attrs ? flattenAttrs(attrs) : {}),
    ...(error !== undefined && !(error instanceof Error)
      ? { error_value: String(error) }
      : error instanceof Error
        ? { error_name: error.name, error_message: error.message }
        : {}),
  };
  // Debug stays local: it is high-volume and the first place stray user
  // content would leak into an exported log line.
  if (level !== "debug") {
    posthog.captureLog({ body: message, level, attributes });
    // Breadcrumb attached to the next captured exception.
    posthog.addExceptionStep(`${namespace}: ${message}`, attributes);
  }
  if (level === "error" && error !== undefined) {
    reportError(error, { log_namespace: namespace, log_message: message });
  }
}

/** Structured logger: always mirrors to the devtools console; when telemetry
 * is on, info+ ships to PostHog Logs and doubles as exception breadcrumbs. */
export function createLogger(namespace: string): Logger {
  return {
    debug: (message, attrs) => emit(namespace, "debug", message, attrs),
    info: (message, attrs) => emit(namespace, "info", message, attrs),
    warn: (message, attrs) => emit(namespace, "warn", message, attrs),
    error: (message, error, attrs) =>
      emit(namespace, "error", message, attrs, error),
  };
}
