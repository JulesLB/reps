import type { Activity, AppData, DayTemplate, Exercise, RotationStep, Session } from "./types";
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

/** Same idea for deleted day templates. A plan has tens of days, never hundreds. */
const MAX_DELETED_DAYS = 100;

function mergeIds(a: string[], b: string[], cap: number): string[] {
  return [...new Set([...(a ?? []), ...(b ?? [])])].slice(-cap);
}

function mergeDiscarded(a: string[], b: string[]): string[] {
  return mergeIds(a, b, MAX_DISCARDED);
}

/**
 * Union day templates by id rather than taking one side's array wholesale.
 *
 * Wholesale was the bug: `days` came entirely from whichever side had the
 * newer `planUpdatedAt`, so a device holding an older copy of the plan
 * deleted every day the other side had added the moment it made any plan edit
 * of its own. On 2026-08-25 a phone still carrying the pre-push plan tapped
 * "use this phase's cycle", won the merge on its fresh stamp, and wiped the
 * three day templates the program had just been built around — leaving a
 * Hyrox cycle pointing at days that no longer existed.
 *
 * Absence therefore can't mean "deleted" any more; only a tombstone can
 * (see `deletedDayIds`). The winning plan still owns content and order for
 * days both sides have — that keeps rename/reorder edits resolving by
 * timestamp exactly as before — and days only the other side knows about are
 * appended as the additions they are.
 */
function mergeDays(
  winner: DayTemplate[],
  loser: DayTemplate[],
  tombstoned: Set<string>
): DayTemplate[] {
  const out: DayTemplate[] = [];
  const seen = new Set<string>();
  for (const day of [...(winner ?? []), ...(loser ?? [])]) {
    if (!day || tombstoned.has(day.id) || seen.has(day.id)) continue;
    seen.add(day.id);
    out.push(day);
  }
  return out;
}

/**
 * Same union, for the exercise catalog. Nothing in the app deletes an
 * exercise definition — the picker only ever adds — so this needs no
 * tombstone: a key missing on one side is always an addition on the other.
 */
function mergeExercises(
  winner: Record<string, Exercise>,
  loser: Record<string, Exercise>
): Record<string, Exercise> {
  return { ...(loser ?? {}), ...(winner ?? {}) };
}

/**
 * Drop steps pointing at a deleted day and re-normalize, mirroring what
 * deleteDay does locally: removing a step can orphan a `withPrev` onto what
 * is now the first step of the cycle. Steps whose day is merely *missing*
 * are deliberately kept — that is the "this device hasn't got it yet" case,
 * and dropping them would shrink the cycle for real.
 */
function pruneRotation(rot: RotationStep[], tombstoned: Set<string>): RotationStep[] {
  if (!tombstoned.size) return rot ?? [];
  const kept = (rot ?? []).filter((s) => !tombstoned.has(s.dayId));
  if (kept[0]?.withPrev) {
    const { withPrev: _dropped, ...first } = kept[0];
    kept[0] = first;
  }
  return kept;
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
  let planLoses = planWins === remote ? local : remote;
  if (isStockPlan(planWins) && !isStockPlan(planLoses)) {
    [planWins, planLoses] = [planLoses, planWins];
  }
  // The union below treats a day the loser has and the winner doesn't as an
  // addition to keep. That reading only holds for a plan someone actually
  // owns: the factory plan's days are seed output, and unioning them into a
  // customized plan bolts a stock "Legs B" onto a plan that deliberately
  // replaced it. A stock side therefore contributes no days at all — the same
  // judgement the veto above already makes, applied to the union.
  const loserDays = isStockPlan(planLoses) && !isStockPlan(planWins) ? [] : planLoses.days;
  const deletedDayIds = mergeIds(local.deletedDayIds, remote.deletedDayIds, MAX_DELETED_DAYS);
  const tombstoned = new Set(deletedDayIds);
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
    version: 9,
    exercises: mergeExercises(planWins.exercises, planLoses.exercises),
    days: mergeDays(planWins.days, loserDays, tombstoned),
    deletedDayIds,
    rotation: pruneRotation(planWins.rotation, tombstoned),
    hyroxRotation: pruneRotation(planWins.hyroxRotation, tombstoned),
    activeTrack: planWins.activeTrack,
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
    program: pickNewest(local.program, remote.program),
  };
}

export function sameAppData(a: AppData, b: AppData): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
