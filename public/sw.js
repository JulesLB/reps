/**
 * Offline shell for the installed PWA.
 *
 * Why it exists: the app was installable but had no cache, so a single failed
 * request on a cold start put Chrome's "This site can't be reached" over the
 * whole thing — in standalone mode, with no address bar to retry from. That
 * happened twice on 2026-08-25/26 with the site up and signal fine, the
 * browser reporting ERR_CONNECTION_REFUSED.
 *
 * Why it is network-first rather than the usual cache-first shell: a stale
 * cached bundle is the single most destructive thing that can happen to this
 * app. Four data wipes came from a phone running old JavaScript against a
 * newer blob (lib/buildStamp.ts). A cache-first worker would institutionalise
 * exactly that. So the network always wins when it answers, and the cache is
 * only ever consulted after a fetch has actually failed. The cost is a round
 * trip the app was already paying; the benefit is that a refused connection
 * degrades to "yesterday's shell" instead of a dead screen.
 */

/**
 * The build this worker belongs to, from the `?v=` its registration carries
 * (components/ServiceWorker.tsx). Two things depend on it:
 *
 * 1. The script URL changes every deploy, so the browser installs a new worker
 *    and the precache below is rebuilt against the current build. A worker
 *    registered at a fixed URL never reinstalls, and would serve one build's
 *    HTML against another build's chunks forever.
 * 2. The cache is named per build and `activate` drops every other one, so no
 *    dead chunk from an old deploy is ever reachable.
 */
const STAMP = new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE = `reps-shell-${STAMP}`;

/**
 * The app's five routes. Their URLs are stable across builds (only the assets
 * underneath are hashed), so they can be precached by name. Without this, an
 * offline navigation to a route the user hadn't opened yet fell back to
 * whatever shell was cached and the app hydrated the wrong page under the
 * right URL.
 */
const ROUTES = ["/", "/plan", "/history", "/progress", "/coach"];

/** Hashed build assets referenced by a route's HTML: chunks and stylesheets. */
const ASSET_RE = /(?:src|href)="(\/_next\/static\/[^"]+)"/g;

/**
 * Safety net only — a per-build cache holds one build's worth of files, well
 * under this. It exists so a pathological case can't grow without bound.
 */
const MAX_ENTRIES = 300;

async function trim(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_ENTRIES) return;
  // Cache.keys() is insertion order, so the front is oldest. Routes are never
  // evicted: they are precached first, which would otherwise make them the
  // first to go, and they are the only entries that must always be present.
  const evictable = keys.filter((k) => !ROUTES.includes(new URL(k.url).pathname));
  for (const key of evictable.slice(0, keys.length - MAX_ENTRIES)) await cache.delete(key);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Each route document, plus the chunks its HTML names — an HTML-only
      // precache leaves a page that loads but can't hydrate, which looks more
      // broken than the error page it replaced. Read the URLs out of the
      // markup rather than guessing them: they are content-hashed per build.
      const assets = new Set();
      await Promise.allSettled(
        ROUTES.map(async (route) => {
          const res = await fetch(route, { cache: "reload" });
          if (!res.ok) return;
          const html = await res.clone().text();
          await cache.put(route, res);
          for (const [, url] of html.matchAll(ASSET_RE)) assets.add(url);
        })
      );
      // Best effort throughout: a file that fails to precache is fetched later
      // on demand. Install must never fail over one bad response, or there is
      // no worker at all and we are back to the dead screen.
      await Promise.allSettled([...assets].map((url) => cache.add(url)));
    })()
  );
  // Take over straight away rather than waiting for every tab to close — a
  // worker stuck in "waiting" on a long-lived PWA tab is the staleness trap
  // all over again.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name !== CACHE) await caches.delete(name);
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Anything not served by this origin — Supabase above all — is none of this
  // worker's business. Auth and sync must never read through a cache.
  if (url.origin !== self.location.origin) return;
  // The staleness detector itself. Caching it would let a stale tab compare
  // its build stamp against a copy of its own build stamp and conclude it is
  // current, which is the one answer that must never be wrong.
  if (url.pathname === "/build-stamp") return;

  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(request);
        // Opaque and error responses are passed through uncached: a cached 404
        // outlives the deploy that fixed it.
        if (fresh.ok && fresh.type === "basic") {
          const cache = await caches.open(CACHE);
          await cache.put(request, fresh.clone());
          await trim(cache);
        }
        return fresh;
      } catch (err) {
        const cached = await caches.match(request);
        if (cached) return cached;
        // Last resort for a navigation to something not precached: the start
        // URL at least boots the app, and its router takes over from there.
        if (request.mode === "navigate") {
          const shell = await caches.match("/");
          if (shell) return shell;
        }
        throw err;
      }
    })()
  );
});
