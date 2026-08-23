import type { AppData, DayTemplate, Exercise, RotationStep, Settings } from "./types";

/**
 * A rolling local archive of plan states. One overwritable rescue slot proved
 * not enough: when a bad merge or a bad restore clobbers the plan
 * (2026-07-25, twice), recovery meant rebuilding templates by hand. Every
 * distinct plan state now lands here on its way in or out, so any clobber is
 * undone from Settings in two taps. Local only, never synced.
 */
export interface PlanSnapshot {
  at: number;
  days: DayTemplate[];
  /** Steps on v8+ snapshots; plain day-id strings on ones taken before. */
  rotation: RotationStep[] | string[];
  /** Absent on snapshots taken before the two-plan split. */
  hyroxRotation?: RotationStep[];
  planStart: string;
  exercises: Record<string, Exercise>;
  settings: Settings;
}

const HISTORY_KEY = "gym-tracker-plan-history";
const MAX_SNAPSHOTS = 10;

function sliceSig(s: Omit<PlanSnapshot, "at">): string {
  return JSON.stringify([s.days, s.rotation, s.hyroxRotation ?? [], s.planStart, s.exercises, s.settings]);
}

export function planSlice(d: AppData): Omit<PlanSnapshot, "at"> {
  return {
    days: d.days,
    rotation: d.rotation,
    hyroxRotation: d.hyroxRotation,
    planStart: d.planStart,
    exercises: d.exercises,
    settings: d.settings,
  };
}

export function samePlanSlice(a: Omit<PlanSnapshot, "at">, b: Omit<PlanSnapshot, "at">): boolean {
  return sliceSig(a) === sliceSig(b);
}

export function planSnapshots(): PlanSnapshot[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const list = raw ? (JSON.parse(raw) as PlanSnapshot[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** Archive the plan slice of `d` unless it matches the newest snapshot. Best effort. */
export function recordPlan(d: AppData): void {
  try {
    const list = planSnapshots();
    const snap = planSlice(d);
    if (list[0] && sliceSig(list[0]) === sliceSig(snap)) return;
    list.unshift({ at: Date.now(), ...snap });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_SNAPSHOTS)));
  } catch {
    // History must never block a save; worst case is a missing snapshot.
  }
}
