/**
 * Detects when this tab is running an older deploy than the one currently
 * live, and reloads it into the new build.
 *
 * Why this exists: the app is an installed PWA, and Android/iOS resume its tab
 * with whatever JavaScript it was opened with — for days. Every data-loss
 * incident so far (2026-07-25, three times) came from exactly that: a resumed
 * tab on an old bundle pulled a blob written by a newer build, mangled it
 * through its outdated migrate(), and pushed the wreckage to the cloud. The
 * version guard in lib/sync.ts stops the write; this closes the gap by getting
 * the stale tab onto the current build so it can sync at all.
 *
 * BUILD_STAMP is baked into the client bundle at build time (next.config.ts),
 * and /build-stamp is a static route baked from the same value in the same
 * build. After a deploy the route serves the new build's stamp while an old
 * tab still holds its own — a mismatch is proof of staleness.
 */

const BUILD_STAMP = process.env.NEXT_PUBLIC_BUILD_STAMP ?? "dev";

/** One reload attempt per remote stamp, so a misbehaving CDN can't loop the page. */
const RELOADED_KEY = "gym-tracker-reloaded-for";

/**
 * True when this tab is stale and a reload has been triggered (or already
 * attempted) — the caller must abort whatever it was about to do. False means
 * fresh, or that freshness could not be determined (offline), which is safe:
 * an offline client can't push anything anyway.
 */
export async function reloadIfStale(): Promise<boolean> {
  if (typeof window === "undefined" || BUILD_STAMP === "dev") return false;
  let remote: string;
  try {
    const res = await fetch("/build-stamp", { cache: "no-store" });
    if (!res.ok) return false;
    remote = ((await res.json()) as { stamp?: string }).stamp ?? "";
  } catch {
    return false;
  }
  if (!remote || remote === BUILD_STAMP) return false;

  try {
    if (sessionStorage.getItem(RELOADED_KEY) === remote) return true;
    sessionStorage.setItem(RELOADED_KEY, remote);
  } catch {
    // Can't track attempts: still reload once — worst case the guard in
    // sync.ts keeps the tab read-only.
  }
  window.location.reload();
  return true;
}
