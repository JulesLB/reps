import type {
  AppData,
  CardioLog,
  DayTemplate,
  ExerciseLog,
  PlanEntry,
  RotationStep,
  Session,
  SetLog,
  Track,
} from "./types";
import { uid } from "./id";

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

/** The cycle of whichever plan the Train tab is on: gym or Hyrox. */
export function activeRotation(data: AppData): RotationStep[] {
  return data.activeTrack === "hyrox" ? (data.hyroxRotation ?? []) : (data.rotation ?? []);
}

/** Which plan's cycle a session advanced; sessions from before the split read as gym. */
export function sessionPlan(s: Session): Track {
  return s.plan === "hyrox" ? "hyrox" : "gym";
}

export interface RotationItem {
  day: DayTemplate;
  index: number;
  /** Same calendar day as the previous step (AM/PM pairing). */
  withPrev: boolean;
}

/** The active plan's rotation resolved to real templates, in cycle order. */
export function rotationDays(data: AppData): RotationItem[] {
  return activeRotation(data)
    .map((step, index) => {
      const day = data.days.find((d) => d.id === step.dayId);
      return day ? { day, index, withPrev: step.withPrev === true && index > 0 } : null;
    })
    .filter((x): x is RotationItem => x !== null);
}

/**
 * The cycle as calendar-day groups: consecutive steps linked by `withPrev`
 * render as one training day (AM lift, PM run). A group of one is an
 * ordinary single-session day.
 */
export function rotationGroups(data: AppData): RotationItem[][] {
  const groups: RotationItem[][] = [];
  for (const item of rotationDays(data)) {
    if (item.withPrev && groups.length) groups[groups.length - 1].push(item);
    else groups.push([item]);
  }
  return groups;
}

/**
 * Day types of the active plan's track that sit in neither cycle. Days living
 * in the other plan's rotation are hidden entirely: starting one means
 * switching plans first, so it advances the right cycle.
 */
export function extraDays(data: AppData): DayTemplate[] {
  const inCycle = new Set(
    [...(data.rotation ?? []), ...(data.hyroxRotation ?? [])].map((s) => s.dayId)
  );
  return data.days.filter(
    (d) => !inCycle.has(d.id) && (d.track ?? "gym") === data.activeTrack
  );
}

/**
 * Where the active plan's cycle stands. Position comes from the last finished
 * session of THIS plan (each plan advances independently), using that
 * session's own recorded slot so a day appearing twice in the cycle (Pull)
 * advances correctly rather than always resolving to its first occurrence.
 */
export function nextRotationIndex(data: AppData): number {
  const rot = activeRotation(data);
  if (!rot.length) return 0;
  const last = finishedSessions(data).find((s) => sessionPlan(s) === data.activeTrack);
  if (!last) return 0;
  const li =
    typeof last.rotationIndex === "number" && last.rotationIndex < rot.length
      ? last.rotationIndex
      : rot.findIndex((s) => s.dayId === last.dayId);
  if (li < 0) return 0;
  return (li + 1) % rot.length;
}

export interface Suggestion {
  day: DayTemplate;
  index: number;
}

/** What to train next: simply the next step in the active plan's cycle. */
export function suggestNextDay(data: AppData): Suggestion | null {
  const rot = activeRotation(data);
  // An empty Hyrox cycle is a real state (no phase loaded yet); the home
  // screen renders its own pointer to the Plan tab instead of a suggestion.
  if (!rot.length) return null;
  const start = nextRotationIndex(data);
  // Walk the cycle rather than reading one slot: a step whose day template
  // this device hasn't got is a gap to step over, not a reason to render "no
  // sessions yet" over a cycle that is mostly fine. That exact null took out
  // the whole Train screen on 2026-08-26, when a sync dropped three of the
  // nine days the Hyrox cycle pointed at (see missingRotationDayIds).
  for (let i = 0; i < rot.length; i++) {
    const index = (start + i) % rot.length;
    const day = data.days.find((d) => d.id === rot[index].dayId);
    if (day) return { day, index };
  }
  return null;
}

/**
 * Steps of the active cycle whose day template is nowhere in this blob, in
 * cycle order and deduplicated. Always a bug somewhere upstream — a program
 * pushed without its day templates, or a sync that dropped them — so the
 * Train tab names it rather than quietly rendering a shorter cycle.
 */
export function missingRotationDayIds(data: AppData): string[] {
  const known = new Set(data.days.map((d) => d.id));
  return [...new Set(activeRotation(data).map((s) => s.dayId).filter((id) => !known.has(id)))];
}

/**
 * The slot to record when starting a day by hand: the first occurrence at or
 * after the expected next step. Jumping to Legs A therefore continues the cycle
 * from Legs A rather than restarting it.
 */
export function rotationIndexFor(data: AppData, dayId: string): number | undefined {
  const rot = activeRotation(data);
  if (!rot.some((s) => s.dayId === dayId)) return undefined;
  const start = nextRotationIndex(data);
  for (let i = 0; i < rot.length; i++) {
    const idx = (start + i) % rot.length;
    if (rot[idx].dayId === dayId) return idx;
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

export interface ExerciseHistoryEntry {
  startedAt: number;
  sets: SetLog[];
}

/**
 * The last `n` sessions that logged real work for this exercise, newest first,
 * each reduced to its done work sets. Prefers the current day type so the
 * "last time" line matches what you're training, falling back to any day type
 * when this one has no history (a fresh day, or right after a rename).
 */
export function exerciseHistory(
  data: AppData,
  exerciseId: string,
  dayId: string | undefined,
  n: number
): ExerciseHistoryEntry[] {
  const collect = (scoped: boolean): ExerciseHistoryEntry[] => {
    const out: ExerciseHistoryEntry[] = [];
    for (const session of finishedSessions(data)) {
      if (scoped && dayId && session.dayId !== dayId) continue;
      const log = session.logs.find(
        (l) => l.exerciseId === exerciseId && l.sets.some((s) => s.done && !s.warmup)
      );
      if (log) out.push({ startedAt: session.startedAt, sets: log.sets.filter((s) => s.done && !s.warmup) });
      if (out.length === n) break;
    }
    return out;
  };
  const scoped = dayId ? collect(true) : [];
  return scoped.length ? scoped : collect(false);
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
    if (log?.cardio)
      return {
        minutes: log.cardio.minutes,
        level: log.cardio.level,
        done: false,
        ...(log.cardio.distanceKm ? { distanceKm: log.cardio.distanceKm } : {}),
      };
  }
  return { minutes: 30, level: 8, done: false };
}

/**
 * Whether an entry logs as cardio (minutes + distance) or as sets × reps.
 * Decided per exercise, so a Hyrox hybrid day can mix a run with wall balls:
 * cardio-group exercises always log minutes, everything else logs sets, and
 * the day's style only decides the fallback for an unknown exercise.
 */
export function entryIsCardio(data: AppData, day: DayTemplate, exerciseId: string): boolean {
  const ex = data.exercises[exerciseId];
  if (!ex) return day.style === "cardio";
  return ex.muscle === "cardio";
}

/**
 * A cardio entry with 2+ sets logs as intervals — erg repeats with the rest
 * timer, `reps` carrying meters per interval — instead of one steady
 * minutes+km block. Decided from the entry so the same exercise can be a
 * steady row one day and 5×500 m the next.
 */
export function entryIsInterval(data: AppData, day: DayTemplate, entry: PlanEntry): boolean {
  return entryIsCardio(data, day, entry.exerciseId) && entry.sets >= 2;
}

/** A logged interval-cardio exercise: set-based sets on a cardio exercise, meters in `reps`. */
export function isIntervalLog(data: AppData, log: ExerciseLog): boolean {
  return !log.cardio && data.exercises[log.exerciseId]?.muscle === "cardio";
}

export function buildSession(data: AppData, day: DayTemplate, now: number): Session {
  const entries = visibleEntries(data, day, now).filter((e) => data.exercises[e.exerciseId]);
  const logs: ExerciseLog[] = entries.map((e) => {
    if (entryIsInterval(data, day, e)) {
      return {
        exerciseId: e.exerciseId,
        sets: Array.from({ length: e.sets }, () => ({ weight: 0, reps: e.reps, done: false })),
        targetSets: e.sets,
        targetReps: e.reps,
        ...(e.note ? { note: e.note } : {}),
      };
    }
    if (entryIsCardio(data, day, e.exerciseId)) {
      return {
        exerciseId: e.exerciseId,
        sets: [],
        cardio: prefillCardio(data, e.exerciseId),
        ...(e.note ? { note: e.note } : {}),
      };
    }
    return {
      exerciseId: e.exerciseId,
      sets: prefillSets(data, e.exerciseId, { sets: e.sets, reps: e.reps }, day.id),
      targetSets: e.sets,
      targetReps: e.reps,
      ...(e.distanceM ? { targetDistanceM: e.distanceM } : {}),
      ...(e.note ? { note: e.note } : {}),
    };
  });
  const index = rotationIndexFor(data, day.id);
  return {
    id: uid(),
    dayId: day.id,
    dayName: day.name,
    style: day.style,
    ...(day.track ? { track: day.track } : {}),
    ...(index === undefined ? {} : { rotationIndex: index, plan: data.activeTrack }),
    date: new Date(now).toISOString(),
    startedAt: now,
    logs,
  };
}

/* ---- rest -------------------------------------------------------------- */

// Word boundaries on the short tokens so "chin" doesn't match "maCHINe" and
// "dip" doesn't match a random substring — otherwise every "… Machine"
// isolation lift got wrongly tagged compound and pushed to the long rest.
const COMPOUND = /press|row|pulldown|pull-?up|\bchin\b|squat|deadlift|thrust|\bdips?\b|lunge/i;
// Small, fast-recovering muscles that don't need the full isolation rest.
const SHORT = /lateral raise|rear delt|reverse pec|face pull|calf|crunch|plank/i;

export function restFor(data: AppData, exerciseId: string): number {
  const ex = data.exercises[exerciseId];
  if (!ex) return data.settings.restIsolation;
  if (ex.rest) return ex.rest;
  if (COMPOUND.test(ex.name)) return data.settings.restCompound;
  if (ex.muscle === "calves" || ex.muscle === "core" || SHORT.test(ex.name)) {
    return data.settings.restShort ?? 60;
  }
  return data.settings.restIsolation;
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

export function sessionDistanceKm(session: Session): number {
  return session.logs.reduce((sum, log) => sum + (log.cardio?.done ? (log.cardio.distanceKm ?? 0) : 0), 0);
}

/** Meters logged across interval-cardio sets (erg repeats), summed for the summary line. */
export function sessionErgMeters(data: AppData, session: Session): number {
  return session.logs.reduce((sum, log) => {
    if (log.cardio || data.exercises[log.exerciseId]?.muscle !== "cardio") return sum;
    return sum + log.sets.reduce((s, set) => (set.done ? s + set.reps : s), 0);
  }, 0);
}

/** Which track a session belongs to; sessions from before tracks read as gym. */
export function sessionTrack(session: Session): "gym" | "hyrox" {
  return session.track === "hyrox" ? "hyrox" : "gym";
}

/* ---- running ----------------------------------------------------------- */

export interface RunPoint {
  t: number;
  km: number;
  minutes: number;
  /** Minutes per km. */
  pace: number;
}

const RUN_NAME = /\brun\b|\brunning\b|treadmill/i;

/**
 * Every logged run with a distance, oldest first: cardio blocks inside
 * sessions (exercise name says run) plus outdoor runs from the activity log.
 * Ergs and bikes are deliberately excluded — pace only means something
 * within one modality.
 */
export function runHistory(data: AppData): RunPoint[] {
  const points: RunPoint[] = [];
  for (const session of finishedSessions(data)) {
    for (const log of session.logs) {
      const c = log.cardio;
      if (!c?.done || !c.distanceKm || c.distanceKm <= 0 || c.minutes <= 0) continue;
      const name = data.exercises[log.exerciseId]?.name ?? "";
      if (!RUN_NAME.test(name)) continue;
      points.push({ t: session.startedAt, km: c.distanceKm, minutes: c.minutes, pace: c.minutes / c.distanceKm });
    }
  }
  for (const a of data.activities) {
    if (a.deleted || a.type !== "run" || !a.distanceKm || a.distanceKm <= 0 || a.minutes <= 0) continue;
    points.push({
      t: new Date(`${a.date}T12:00:00`).getTime(),
      km: a.distanceKm,
      minutes: a.minutes,
      pace: a.minutes / a.distanceKm,
    });
  }
  return points.sort((a, b) => a.t - b.t);
}

/** Run km per ISO week (Monday start) for the trailing `n` weeks, oldest first. */
export function weeklyRunKm(data: AppData, n: number, now: number = Date.now()): Array<{ weekStart: number; km: number }> {
  const WEEK = 7 * 24 * 3600 * 1000;
  const thisWeek = weekStart(now);
  const buckets = Array.from({ length: n }, (_, i) => ({ weekStart: thisWeek - (n - 1 - i) * WEEK, km: 0 }));
  for (const p of runHistory(data)) {
    const ws = weekStart(p.t);
    const b = buckets.find((x) => x.weekStart === ws);
    if (b) b.km += p.km;
  }
  return buckets;
}

/** "5:42" for 5.7 min/km; the /km suffix is the caller's. */
export function formatPace(minPerKm: number): string {
  if (!Number.isFinite(minPerKm) || minPerKm <= 0) return "—";
  const total = Math.round(minPerKm * 60);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
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
