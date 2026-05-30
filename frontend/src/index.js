import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// PWA: register service worker for offline app-shell + install-to-home-screen.
// Force-check for SW updates on every load so engineers automatically pick up
// new deploys instead of being stuck on a cached old bundle.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // Trigger an update check immediately
        reg.update().catch(() => {});
        // When a new SW takes control, hard-reload so the page runs the new bundle
        reg.addEventListener("updatefound", () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener("statechange", () => {
            if (nw.state === "activated" && navigator.serviceWorker.controller) {
              // Already had an SW running and a new one just activated — reload
              window.location.reload();
            }
          });
        });
      })
      .catch((err) => console.warn("SW registration failed:", err));
  });
}
