import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@thegreataxios/webmcp-examples-theme/theme.css";
import "@thegreataxios/webmcp-examples-theme/motion.css";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
