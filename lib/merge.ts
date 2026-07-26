import type { Activity, AppData, Session } from "./types";
import { isStockPlan } from "./plan";

/** More logged sets and a finish beat a thinner or still-in-progress copy of the same session. */
function sessionWeight(s: Session): number {
  const loggedSets = s.logs.reduce((n, l) => n + l.sets.length, 0);
  return (s.finishedAt ? 1_000_000 : 0) + loggedSets;
}

function mergeSessions(a: Session[], b: Session[]): Session[] {
  const byId = new Map<string, Session>();
  for (const s of a) byId.set(s.id, s);
  for (const s of b) {
    const existing = byId.get(s.id);
    if (!existing || sessionWeight(s) > sessionWeight(existing)) byId.set(s.id, s);
  }
  return [...byId.values()].sort((x, y) => x.startedAt - y.startedAt);
}

/** Cap on discard tombstones kept per blob, newest last. Ids are tiny; this only bounds growth. */
const MAX_DISCARDED = 50;

function mergeDiscarded(a: string[], b: string[]): string[] {
  return [...new Set([...(a ?? []), ...(b ?? [])])].slice(-MAX_DISCARDED);
}

function pickActive(a: Session | null, b: Session | null): Session | null {
  if (!a) return b;
  if (!b) return a;
  if (a.id === b.id) {
    // Same live session on two devices: the most recently edited copy wins, so
    // deleting an exercise (which drops the logged-set count) sticks instead of
    // losing to a heavier pre-delete copy. Fall back to weight only when a
    // timestamp is missing or tied (legacy blobs, simultaneous edits).
    const at = a.updatedAt ?? 0;
    const bt = b.updatedAt ?? 0;
    if (at !== bt) return at > bt ? a : b;
    return sessionWeight(a) >= sessionWeight(b) ? a : b;
  }
  return a.startedAt >= b.startedAt ? a : b;
}

/** Union by id; the more recently edited copy of an entry wins. */
function mergeActivities(a: Activity[], b: Activity[]): Activity[] {
  const byId = new Map<string, Activity>();
  for (const x of a ?? []) byId.set(x.id, x);
  for (const x of b ?? []) {
    const existing = byId.get(x.id);
    if (!existing || (x.updatedAt ?? 0) > (existing.updatedAt ?? 0)) byId.set(x.id, x);
  }
  return [...byId.values()].sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
}

/**
 * Wholesale last-writer-wins for slices small enough that a field-level merge
 * would buy nothing: health and coach are only ever written by the laptop
 * pipeline, and profile is a handful of lines edited one device at a time. An
 * updatedAt tie with different content falls back to a content comparison so
 * the pick stays commutative.
 */
function pickNewest<T extends { updatedAt: number }>(a: T, b: T): T {
  const at = a?.updatedAt ?? 0;
  const bt = b?.updatedAt ?? 0;
  if (at !== bt) return at > bt ? a : b;
  return JSON.stringify(a) >= JSON.stringify(b) ? a : b;
}

/**
 * Merge a remote snapshot into local state without ever silently dropping a
 * logged session: sessions always union by id, keeping whichever copy of a
 * given session is more complete. Plan/day/exercise/settings edits resolve by
 * their own `planUpdatedAt` timestamp, kept separate from session activity,
 * so logging a workout on one device can never make a stale plan snapshot on
 * another device look "newer" and revert real plan edits. Commutative and
 * safe to run in either direction — this replaced a whole-blob
 * last-write-wins sync that lost a session and reverted the plan on
 * 2026-07-21 when a stale browser tab pushed over newer phone data.
 */
export function mergeAppData(local: AppData, remote: AppData): AppData {
  let planWins = remote.planUpdatedAt > local.planUpdatedAt ? remote : local;
  // Content veto on top of the timestamp rule: the factory plan never beats a
  // customized one, no matter how fresh its stamp. A stale stock snapshot
  // restored with a boosted planUpdatedAt (RecoverPanel, 2026-07-25) won every
  // merge and reverted the user's templates on every device; content-based,
  // so it stays commutative.
  const planLoses = planWins === remote ? local : remote;
  if (isStockPlan(planWins) && !isStockPlan(planLoses)) planWins = planLoses;
  const sessions = mergeSessions(local.sessions, remote.sessions);
  const discardedActiveIds = mergeDiscarded(local.discardedActiveIds, remote.discardedActiveIds);

  // A bare `active: null` can't out-argue a live `active` from the other side
  // (pickActive treats null as "no opinion"), so clearing the active session
  // never propagated and a finished session kept re-opening after sync. Drop
  // any active that's already finished (it's in `sessions`) or was discarded
  // (it's tombstoned), so a Finish or Discard on one device finally sticks.
  const cleared = new Set(discardedActiveIds);
  for (const s of sessions) if (s.finishedAt != null) cleared.add(s.id);
  const picked = pickActive(local.active, remote.active);
  const active = picked && cleared.has(picked.id) ? null : picked;

  return {
    version: 7,
    exercises: planWins.exercises,
    days: planWins.days,
    rotation: planWins.rotation,
    planStart: planWins.planStart,
    settings: planWins.settings,
    planUpdatedAt: planWins.planUpdatedAt,
    sessions,
    active,
    discardedActiveIds,
    activities: mergeActivities(local.activities, remote.activities),
    health: pickNewest(local.health, remote.health),
    coach: pickNewest(local.coach, remote.coach),
    profile: pickNewest(local.profile, remote.profile),
  };
}

export function sameAppData(a: AppData, b: AppData): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
