import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import "./globals.css";

import { useConsoleStore } from "@/lib/store";

/**
 * DEV-only handle for the Playwright suite, which has no backend and therefore
 * no way to obtain a real recommendation. `import.meta.env.DEV` is statically
 * false in a production build, so this and the store reference are removed by
 * dead-code elimination rather than shipped to prospects.
 */
if (import.meta.env.DEV) {
  (window as unknown as { __arkaforgeStore?: typeof useConsoleStore }).__arkaforgeStore =
    useConsoleStore;
}

const container = document.getElementById("root");
if (!container) {
  throw new Error("console root element missing");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
