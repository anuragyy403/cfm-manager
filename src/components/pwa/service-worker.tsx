"use client";

import { useEffect } from "react";
import { listenForInstallPrompt } from "./pwa";

/**
 * Registers `/sw.js` (shows push notifications) and catches the browser's
 * install prompt for the "Install app" button. Renders nothing.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => listenForInstallPrompt(), []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((e) => console.error("Service worker registration failed", e));
  }, []);
  return null;
}
