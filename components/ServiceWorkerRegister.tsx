"use client";

import { useEffect } from "react";

/** Registers /sw.js in production only, so dev never serves a stale shell. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Offline shell is a nice to have; the app works without it.
    });
  }, []);
  return null;
}
