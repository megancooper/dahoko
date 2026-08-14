import { useEffect } from "react";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { reportError } from "@/lib/telemetry";

export function CrashScreen({ detail }: { detail?: string }) {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-background px-6 text-foreground">
      <p className="text-[15px] font-semibold tracking-tight">
        Something went wrong.
      </p>
      <p className="max-w-md text-center text-[12.5px] leading-relaxed text-muted-foreground">
        {detail ??
          "The app hit an unexpected error. Your data is stored locally and is safe."}
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-2 rounded-md border border-border bg-secondary px-3 py-1.5 text-[12.5px] font-medium hover:bg-secondary/80"
      >
        Reload dahoko
      </button>
    </div>
  );
}

/** Router-level error boundary; reports the render error, then offers a
 * reload. Effect deps keep repeated renders of one error to one report. */
export function RouteErrorFallback({ error }: ErrorComponentProps) {
  useEffect(() => {
    reportError(error, { boundary: "route" });
  }, [error]);
  return (
    <CrashScreen
      detail={error instanceof Error ? error.message : undefined}
    />
  );
}
