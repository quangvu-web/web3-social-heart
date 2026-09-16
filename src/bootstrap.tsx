import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { AppErrorBoundary } from "@/components/common/AppErrorBoundary";
import "./index.css";

function bootstrapApp(rootElement: HTMLElement) {
  window.__FUN_PROFILE_APP_MOUNTED__ = true;

  createRoot(rootElement).render(
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  );
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Missing #root element");
}

bootstrapApp(rootElement);
