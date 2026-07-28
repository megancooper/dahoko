import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app";
import "@dahoko/ui/index.css";
import "./site.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
