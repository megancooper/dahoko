import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app";
import { initTelemetry, reportError } from "./telemetry";
import "@dahoko/ui/index.css";
import "./site.css";

// Before render so exception autocapture covers startup errors.
initTelemetry();

ReactDOM.createRoot(document.getElementById("root")!, {
  // React 19 no longer rethrows render errors to window.onerror, so the
  // global exception autocapture needs this explicit hook.
  onUncaughtError: (error, errorInfo) => {
    reportError(error, { componentStack: errorInfo.componentStack });
    console.error(error);
  },
}).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
