import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import posthog from "posthog-js";
import { PostHogErrorBoundary, PostHogProvider } from "@posthog/react";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { initTelemetry } from "@/lib/telemetry";
import { CrashScreen, RouteErrorFallback } from "@/components/route-error";
import "@dahoko/ui/index.css";
import "./styles.css";

// Before render so exception autocapture covers startup errors.
initTelemetry();

const router = createRouter({
  routeTree,
  defaultErrorComponent: RouteErrorFallback,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PostHogProvider client={posthog}>
      {/* Outer net for errors the router's own boundary cannot catch. */}
      <PostHogErrorBoundary fallback={<CrashScreen />}>
        <RouterProvider router={router} />
      </PostHogErrorBoundary>
    </PostHogProvider>
  </StrictMode>,
);
