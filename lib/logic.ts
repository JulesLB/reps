import type {
  AppData,
  CardioLog,
  DayTemplate,
  ExerciseLog,
  PlanEntry,
  Session,
  SetLog,
} from "./types";

export function finishedSessions(data: AppData): Session[] {
  return data.sessions
    .filter((s) => s.finishedAt)
    .sort((a, b) => b.startedAt - a.startedAt);
}

/* ---- plan calendar ----------------------------------------------------- */

export function weekStart(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7;
  return d.getTime() - day * 24 * 3600 * 1000;
}

/** 1-based plan week; drives rehab gates like "hammer curls from week 4". */
export function planWeek(data: AppData, now: number = Date.now()): number {
  if (!data.planStart) return 1;
  const start = weekStart(new Date(data.planStart + "T00:00:00").getTime());
  const diff = Math.floor((weekStart(now) - start) / (7 * 24 * 3600 * 1000));
  return Math.max(1, diff + 1);
}

/** The rotation resolved to real templates, in cycle order. */
export function rotationDays(data: AppData): Array<{ day: DayTemplate; index: number }> {
  return (data.rotation ?? [])
    .map((id, index) => {
      const day = data.days.find((d) => d.id === id);
      return day ? { day, index } : null;
    })
    .filter((x): x is { day: DayTemplate; index: number } => x !== null);
}

/** Day types that exist but sit outside the cycle (a one-off cardio day, say). */
export function extraDays(data: AppData): DayTemplate[] {
  const inCycle = new Set(data.rotation ?? []);
  return data.days.filter((d) => !inCycle.has(d.id));
}

/**
 * Where the cycle stands. Position comes from the last finished session's own
 * recorded slot, so a day appearing twice in the cycle (Pull) advances correctly
 * rather than always resolving to its first occurrence.
 */
export function nextRotationIndex(data: AppData): number {
  const rot = data.rotation ?? [];
  if (!rot.length) return 0;
  const last = finishedSessions(data)[0];
  if (!last) return 0;
  const li =
    typeof last.rotationIndex === "number" && last.rotationIndex < rot.length
      ? last.rotationIndex
      : rot.indexOf(last.dayId);
  if (li < 0) return 0;
  return (li + 1) % rot.length;
}

export interface Suggestion {
  day: DayTemplate;
  index: number;
}

/** What to train next: simply the next step in the cycle. */
export function suggestNextDay(data: AppData): Suggestion | null {
  const rot = data.rotation ?? [];
  if (!rot.length) return data.days[0] ? { day: data.days[0], index: 0 } : null;
  const index = nextRotationIndex(data);
  const day = data.days.find((d) => d.id === rot[index]);
  return day ? { day, index } : null;
}

/**
 * The slot to record when starting a day by hand: the first occurrence at or
 * after the expected next step. Jumping to Legs A therefore continues the cycle
 * from Legs A rather than restarting it.
 */
export function rotationIndexFor(data: AppData, dayId: string): number | undefined {
  const rot = data.rotation ?? [];
  if (!rot.includes(dayId)) return undefined;
  const start = nextRotationIndex(data);
  for (let i = 0; i < rot.length; i++) {
    const idx = (start + i) % rot.length;
    if (rot[idx] === dayId) return idx;
  }
  return undefined;
}

/** Hard sets per muscle in one session, for the history breakdown. */
export function sessionMuscles(data: AppData, session: Session): Array<{ muscle: string; sets: number }> {
  const counts = new Map<string, number>();
  for (const log of session.logs) {
    const ex = data.exercises[log.exerciseId];
    if (!ex) continue;
    const n = log.cardio?.done ? 1 : log.sets.filter((s) => s.done && !s.warmup).length;
    if (!n) continue;
    counts.set(ex.muscle, (counts.get(ex.muscle) ?? 0) + n);
  }
  return [...counts.entries()]
    .map(([muscle, sets]) => ({ muscle, sets }))
    .sort((a, b) => b.sets - a.sets);
}

export function entryVisible(entry: PlanEntry, week: number): boolean {
  return !entry.fromWeek || week >= entry.fromWeek;
}

export function visibleEntries(data: AppData, day: DayTemplate, now: number = Date.now()): PlanEntry[] {
  const week = planWeek(data, now);
  return day.entries.filter((e) => entryVisible(e, week));
}

/* ---- per-exercise history ---------------------------------------------- */

export function lastLogFor(data: AppData, exerciseId: string, dayId?: string): ExerciseLog | null {
  for (const session of finishedSessions(data)) {
    if (dayId && session.dayId !== dayId) continue;
    const log = session.logs.find(
      (l) => l.exerciseId === exerciseId && l.sets.some((s) => s.done && !s.warmup)
    );
    if (log) return log;
  }
  return null;
}

export interface OverloadSuggestion {
  from: number;
  to: number;
}

export interface RepTarget {
  sets: number;
  reps: number;
}

export function logTarget(data: AppData, log: ExerciseLog): RepTarget {
  return {
    sets: log.targetSets ?? data.settings.targetSets,
    reps: log.targetReps ?? data.settings.targetReps,
  };
}

function recentLogs(data: AppData, exerciseId: string, dayId: string | undefined, n: number): ExerciseLog[] {
  const out: ExerciseLog[] = [];
  for (const session of finishedSessions(data)) {
    if (dayId && session.dayId !== dayId) continue;
    const log = session.logs.find(
      (l) => l.exerciseId === exerciseId && l.sets.some((s) => s.done && !s.warmup)
    );
    if (log) out.push(log);
    if (out.length === n) break;
  }
  return out;
}

/**
 * Double progression, paced. A load increase needs TWO consecutive clean
 * sessions at the same weight, not one: a single good day is noise, and on a
 * once-a-week day type this settles into roughly +2.5 kg a fortnight per lift.
 * Falls back to any day type when this one has no history (e.g. after a rename).
 */
export function overloadSuggestion(
  data: AppData,
  exerciseId: string,
  target: RepTarget,
  dayId?: string
): OverloadSuggestion | null {
  let logs = dayId ? recentLogs(data, exerciseId, dayId, 2) : [];
  if (logs.length < 2) logs = recentLogs(data, exerciseId, undefined, 2);
  if (logs.length < 2) return null;

  const topWeight = (log: ExerciseLog): number =>
    Math.max(...log.sets.filter((s) => s.done && !s.warmup).map((s) => s.weight));
  const clean = (log: ExerciseLog): boolean => {
    const work = log.sets.filter((s) => s.done && !s.warmup);
    return work.length >= target.sets && work.every((s) => s.reps >= target.reps);
  };

  if (!logs.every(clean)) return null;
  const w = topWeight(logs[0]);
  if (topWeight(logs[1]) !== w) return null;

  const step = w >= 100 ? data.settings.increment * 2 : data.settings.increment;
  return { from: w, to: w + step };
}

export function prefillSets(
  data: AppData,
  exerciseId: string,
  target?: RepTarget,
  dayId?: string
): SetLog[] {
  const t = target ?? { sets: data.settings.targetSets, reps: data.settings.targetReps };
  const log =
    (dayId ? lastLogFor(data, exerciseId, dayId) : null) ?? lastLogFor(data, exerciseId);
  const overload = overloadSuggestion(data, exerciseId, t, dayId);
  const weight = overload
    ? overload.to
    : log
      ? Math.max(...log.sets.filter((s) => !s.warmup).map((s) => s.weight))
      : 20;
  return Array.from({ length: t.sets }, () => ({ weight, reps: t.reps, done: false }));
}

export function prefillCardio(data: AppData, exerciseId: string): CardioLog {
  for (const session of finishedSessions(data)) {
    const log = session.logs.find((l) => l.exerciseId === exerciseId && l.cardio?.done);
    if (log?.cardio) return { minutes: log.cardio.minutes, level: log.cardio.level, done: false };
  }
  return { minutes: 30, level: 8, done: false };
}

export function buildSession(data: AppData, day: DayTemplate, now: number): Session {
  const entries = visibleEntries(data, day, now).filter((e) => data.exercises[e.exerciseId]);
  const logs: ExerciseLog[] =
    day.style === "cardio"
      ? entries.map((e) => ({
          exerciseId: e.exerciseId,
          sets: [],
          cardio: prefillCardio(data, e.exerciseId),
          ...(e.note ? { note: e.note } : {}),
        }))
      : entries.map((e) => ({
          exerciseId: e.exerciseId,
          sets: prefillSets(data, e.exerciseId, { sets: e.sets, reps: e.reps }, day.id),
          targetSets: e.sets,
          targetReps: e.reps,
          ...(e.note ? { note: e.note } : {}),
        }));
  const index = rotationIndexFor(data, day.id);
  return {
    id: `s-${now.toString(36)}`,
    dayId: day.id,
    dayName: day.name,
    style: day.style,
    ...(index === undefined ? {} : { rotationIndex: index }),
    date: new Date(now).toISOString(),
    startedAt: now,
    logs,
  };
}

/* ---- rest -------------------------------------------------------------- */

const COMPOUND = /press|row|pulldown|pull-?up|chin|squat|deadlift|thrust|dip|lunge/i;

export function restFor(data: AppData, exerciseId: string): number {
  const ex = data.exercises[exerciseId];
  if (!ex) return data.settings.restIsolation;
  if (ex.rest) return ex.rest;
  return COMPOUND.test(ex.name) ? data.settings.restCompound : data.settings.restIsolation;
}

/* ---- session stats ----------------------------------------------------- */

export function sessionVolume(session: Session): number {
  return session.logs.reduce(
    (sum, log) =>
      sum +
      log.sets.reduce((s, set) => (set.done && !set.warmup ? s + set.weight * set.reps : s), 0),
    0
  );
}

export function sessionCardioMinutes(session: Session): number {
  return session.logs.reduce((sum, log) => sum + (log.cardio?.done ? log.cardio.minutes : 0), 0);
}

export function sessionSetCounts(session: Session): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const log of session.logs) {
    if (log.cardio) {
      total++;
      if (log.cardio.done) done++;
      continue;
    }
    for (const set of log.sets) {
      if (set.warmup) continue;
      total++;
      if (set.done) done++;
    }
  }
  return { done, total };
}

export function topSetWeight(session: Session, exerciseId: string): number | null {
  const log = session.logs.find((l) => l.exerciseId === exerciseId);
  if (!log) return null;
  const work = log.sets.filter((s) => s.done && !s.warmup);
  if (!work.length) return null;
  return Math.max(...work.map((s) => s.weight));
}

export interface SeriesPoint {
  t: number;
  w: number;
}

export function topSetSeries(data: AppData, exerciseId: string): SeriesPoint[] {
  return finishedSessions(data)
    .map((s) => {
      const w = topSetWeight(s, exerciseId);
      return w === null ? null : { t: s.startedAt, w };
    })
    .filter((p): p is SeriesPoint => p !== null)
    .sort((a, b) => a.t - b.t);
}

export function personalRecords(data: AppData, session: Session): string[] {
  const prs: string[] = [];
  for (const log of session.logs) {
    const current = topSetWeight(session, log.exerciseId);
    if (current === null) continue;
    const previous = finishedSessions(data)
      .filter((s) => s.id !== session.id && s.startedAt < session.startedAt)
      .map((s) => topSetWeight(s, log.exerciseId))
      .filter((w): w is number => w !== null);
    if (previous.length && current > Math.max(...previous)) {
      prs.push(log.exerciseId);
    }
  }
  return prs;
}

export function muscleSetsForRange(data: AppData, from: number, to: number): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const session of finishedSessions(data)) {
    if (session.startedAt < from || session.startedAt >= to) continue;
    for (const log of session.logs) {
      const ex = data.exercises[log.exerciseId];
      if (!ex) continue;
      const n = log.sets.filter((s) => s.done && !s.warmup).length;
      counts[ex.muscle] = (counts[ex.muscle] ?? 0) + n;
    }
  }
  return counts;
}

export function muscleSetsForWeek(data: AppData, weekStartMs: number): Record<string, number> {
  return muscleSetsForRange(data, weekStartMs, weekStartMs + 7 * 24 * 3600 * 1000);
}

export type PeriodKey = "week" | "month" | "quarter" | "all";

export const PERIODS: Array<{ key: PeriodKey; label: string }> = [
  { key: "week", label: "Week" },
  { key: "month", label: "4 weeks" },
  { key: "quarter", label: "3 months" },
  { key: "all", label: "All" },
];

export interface Range {
  from: number;
  to: number;
  /** Weeks covered, for turning totals into a per-week average. */
  weeks: number;
  /** Multi-week periods report per-week averages so the 10-20 band stays comparable. */
  averaged: boolean;
  label: string;
}

export function periodRange(data: AppData, key: PeriodKey, now: number = Date.now()): Range {
  const to = now + 1;
  const WEEK = 7 * 24 * 3600 * 1000;
  if (key === "week") {
    return { from: weekStart(now), to, weeks: 1, averaged: false, label: "This week" };
  }
  if (key === "month") {
    return { from: weekStart(now) - 3 * WEEK, to, weeks: 4, averaged: true, label: "Last 4 weeks" };
  }
  if (key === "quarter") {
    return { from: weekStart(now) - 12 * WEEK, to, weeks: 13, averaged: true, label: "Last 3 months" };
  }
  const earliest = finishedSessions(data).at(-1)?.startedAt ?? now;
  const from = weekStart(earliest);
  return {
    from,
    to,
    weeks: Math.max(1, Math.round((to - from) / WEEK)),
    averaged: true,
    label: "All time",
  };
}

export function rangeStats(
  data: AppData,
  from: number,
  to: number
): { types: WeekTypeStat[]; total: { count: number; durationMs: number } } {
  const inRange = finishedSessions(data).filter((s) => s.startedAt >= from && s.startedAt < to);
  const types: WeekTypeStat[] = data.days.map((day) => {
    const sessions = inRange.filter((s) => s.dayId === day.id);
    return {
      dayId: day.id,
      dayName: day.name,
      count: sessions.length,
      durationMs: sessions.reduce((sum, s) => sum + ((s.finishedAt ?? s.startedAt) - s.startedAt), 0),
    };
  });
  return {
    types,
    total: {
      count: inRange.length,
      durationMs: inRange.reduce((sum, s) => sum + ((s.finishedAt ?? s.startedAt) - s.startedAt), 0),
    },
  };
}

export function formatWeight(w: number): string {
  return Number.isInteger(w) ? String(w) : w.toFixed(1).replace(/\.0$/, "");
}

export function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

export function formatSeconds(total: number): string {
  const s = Math.max(0, Math.round(total));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export interface WeekTypeStat {
  dayId: string;
  dayName: string;
  count: number;
  durationMs: number;
}

export function formatDuration(ms: number): string {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}`;
}
