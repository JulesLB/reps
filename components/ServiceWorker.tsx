"use client";

import { useEffect } from "react";

/**
 * Registers the offline shell (public/sw.js).
 *
 * The build stamp rides along in the URL for two reasons the worker itself
 * documents: it forces a reinstall (and so a fresh precache) on every deploy,
 * and it names that deploy's cache. `updateViaCache: "none"` covers the rest —
 * without it the browser may serve sw.js from its own HTTP cache for up to 24
 * hours, so a worker with a bug in it would outlive the deploy that fixed it.
 * Registration is deferred to load so it never competes with the first paint
 * or the first sync.
 */
const STAMP = process.env.NEXT_PUBLIC_BUILD_STAMP ?? "dev";

export default function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Dev serves uncached chunks that turbopack rewrites constantly; a worker
    // in the middle of that only produces confusing failures.
    if (STAMP === "dev") return;
    const register = () => {
      navigator.serviceWorker
        .register(`/sw.js?v=${encodeURIComponent(STAMP)}`, { updateViaCache: "none" })
        .catch(() => {
          // No offline shell is the old behaviour, not a broken app.
        });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
