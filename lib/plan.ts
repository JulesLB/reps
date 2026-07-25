import type {
  Activity,
  AppData,
  CoachState,
  DayTemplate,
  Exercise,
  HealthData,
  MuscleGroup,
  PlanEntry,
  ProfileData,
  Settings,
} from "./types";

/**
 * Start of plan week 1. Rehab and ramp-up gates ("introduce this from week 4")
 * count from here.
 */
export const PLAN_START = "2026-01-01";

/** Exercises the starter plan needs beyond the base seed list. */
export const PLAN_EXERCISES: Array<[string, string, MuscleGroup]> = [
  ["reverse-pec-deck", "Reverse Pec Deck", "shoulders"],
  ["rdl", "Romanian Deadlift", "hamstrings"],
  ["adductor", "Hip Adduction Machine", "glutes"],
  ["seated-calf", "Seated Calf Raise", "calves"],
];

type EntryDef = [string, number, number, string?, number?];

interface PlanDayDef {
  id: string;
  name: string;
  entries: EntryDef[];
}

/**
 * A six-session push/pull/legs starter plan. Each session runs a heavy and a
 * lighter variant across the cycle: the same weekly hard sets at lower joint
 * load on the second pass. Everything here is editable in the app, so this is
 * only the starting point a fresh install gets.
 */
const PLAN_DAYS: PlanDayDef[] = [
  {
    id: "push-heavy",
    name: "Push · Heavy",
    entries: [
      ["chest-press", 3, 8],
      ["incline-db", 3, 10],
      ["shoulder-press", 3, 10],
      ["lateral-raise", 3, 15],
      ["pec-fly", 2, 12],
      ["triceps-pushdown", 3, 12],
    ],
  },
  {
    id: "push-light",
    name: "Push · Light",
    entries: [
      ["chest-press", 3, 12],
      ["incline-db", 3, 12],
      ["shoulder-press", 3, 12],
      ["lateral-raise", 3, 15],
      ["pec-fly", 2, 15],
      ["triceps-pushdown", 3, 15],
    ],
  },
  {
    id: "pull",
    name: "Pull",
    entries: [
      ["lat-pulldown", 3, 10],
      ["chest-row", 3, 10],
      ["seated-row", 3, 10],
      ["reverse-pec-deck", 3, 15],
      ["face-pull", 3, 12],
      ["hammer-curl", 2, 12],
    ],
  },
  {
    id: "legs-a",
    name: "Legs A",
    entries: [
      ["leg-press", 3, 10],
      ["leg-curl", 3, 10],
      ["hip-thrust", 3, 10],
      ["leg-extension", 2, 15],
      ["calf-raise", 3, 12],
      ["adductor", 2, 12],
    ],
  },
  {
    id: "legs-b",
    name: "Legs B",
    entries: [
      ["rdl", 3, 10, "control the eccentric"],
      ["leg-press", 3, 10, "feet high on the platform"],
      ["leg-curl", 3, 10],
      ["hip-thrust", 3, 10],
      ["seated-calf", 3, 15],
    ],
  },
];

/** The training cycle, in order. Rest days are taken whenever they are needed. */
const PLAN_ROTATION: string[] = [
  "push-heavy",
  "pull",
  "legs-a",
  "push-light",
  "pull",
  "legs-b",
];

/**
 * Make sure every exercise the plan references exists, reusing an existing
 * exercise when one matches by id or (case-insensitive) name so renames and
 * logged history are preserved. Returns def-id → actual-id.
 */
function ensurePlanExercises(exercises: Record<string, Exercise>): Record<string, string> {
  const map: Record<string, string> = {};
  const byName = new Map(
    Object.values(exercises).map((e) => [e.name.trim().toLowerCase(), e.id])
  );
  for (const [id, name, muscle] of PLAN_EXERCISES) {
    if (exercises[id]) {
      map[id] = id;
      continue;
    }
    const existing = byName.get(name.toLowerCase());
    if (existing) {
      map[id] = existing;
      continue;
    }
    exercises[id] = { id, name, muscle };
    map[id] = id;
  }
  return map;
}

function toTemplate(def: PlanDayDef, idMap: Record<string, string>): DayTemplate {
  const entries: PlanEntry[] = def.entries.map(([exerciseId, sets, reps, note, fromWeek]) => ({
    exerciseId: idMap[exerciseId] ?? exerciseId,
    sets,
    reps,
    ...(note ? { note } : {}),
    ...(fromWeek ? { fromWeek } : {}),
  }));
  return {
    id: def.id,
    name: def.name,
    style: "strength",
    entries,
    exerciseIds: entries.map((e) => e.exerciseId),
  };
}

/** Builds the starter day templates against an exercise record, adding missing exercises to it. */
export function buildPlanDays(exercises: Record<string, Exercise>): DayTemplate[] {
  const idMap = ensurePlanExercises(exercises);
  return PLAN_DAYS.map((def) => toTemplate(def, idMap));
}

export function defaultSettings(): Settings {
  return {
    unit: "kg",
    increment: 2.5,
    targetSets: 3,
    targetReps: 8,
    restCompound: 150,
    restIsolation: 90,
    restShort: 60,
  };
}

export function planRotation(): string[] {
  return [...PLAN_ROTATION];
}

/** Order-insensitive fingerprint of what the user actually sees and edits in a plan. */
function daysFingerprint(days: DayTemplate[]): string {
  return JSON.stringify(
    [...(days ?? [])]
      .map((d) => ({
        id: d.id,
        name: d.name,
        style: d.style ?? "strength",
        entries: (d.entries ?? []).map((e) => [
          e.exerciseId,
          e.sets,
          e.reps,
          e.note ?? null,
          e.fromWeek ?? null,
        ]),
      }))
      .sort((a, b) => (a.id < b.id ? -1 : 1))
  );
}

let stockDaysSig: string | null = null;

/**
 * Whether a plan slice is still the untouched factory default. Used by the
 * merge (lib/merge.ts) to refuse letting the stock plan overwrite a customized
 * one on timestamp alone: no device ever has a legitimate reason to assert the
 * factory plan as a fresh deliberate edit, but several paths can accidentally
 * put a fresh stamp on it (a restored rescue snapshot did exactly that on
 * 2026-07-25 and reverted every template rename on every device). A false
 * negative here is safe — it just falls back to the timestamp rule.
 */
export function isStockPlan(d: Pick<AppData, "days" | "rotation" | "planStart">): boolean {
  if (stockDaysSig === null) stockDaysSig = daysFingerprint(buildPlanDays({}));
  return (
    d.planStart === PLAN_START &&
    JSON.stringify(d.rotation) === JSON.stringify(PLAN_ROTATION) &&
    daysFingerprint(d.days) === stockDaysSig
  );
}

/**
 * Bring any stored blob up to the current schema. v1 stored three fixed
 * push/pull/legs templates with no per-exercise targets; v2 added targets plus
 * a 7-slot weekday schedule, which v3 flattens into an ordered cycle. Sessions,
 * exercises, and renames survive every step.
 */
export function migrate(raw: unknown): AppData {
  const d = raw as Partial<AppData> & {
    days?: unknown;
    schedule?: (string | null)[];
  };
  // Read through a plain number so the checks below compare against what's
  // actually in the blob, not the literal type the current build declares.
  const version: number = typeof d.version === "number" ? d.version : 0;

  // v5 added activities/health/coach and v6 added profile; normalize() fills
  // every one of them in when missing, so v4 and v5 blobs need no dedicated step.
  //
  // The `>=` matters as much as the equality. A blob stamped *newer* than this
  // build used to fall through to the v1 rebuild path below and come back as a
  // stock plan with the new slices stripped — which is exactly how a phone
  // still running the v4 bundle wiped a pushed coach review on 2026-07-25.
  // Keeping what we understand and dropping only what we don't is always the
  // safer failure: an old client now degrades instead of destroying.
  if (version >= 4) return normalize(d as AppData);

  if (version === 3) {
    const next = d as unknown as AppData;
    next.planUpdatedAt = 0;
    return normalize(next);
  }

  if (version === 2) {
    const fromSchedule = (d.schedule ?? []).filter((x): x is string => Boolean(x));
    const next = d as unknown as AppData;
    next.rotation = fromSchedule.length ? fromSchedule : planRotation();
    next.planUpdatedAt = 0;
    delete (next as { schedule?: unknown }).schedule;
    return normalize(next);
  }

  const exercises: Record<string, Exercise> = (d.exercises as Record<string, Exercise>) ?? {};
  const oldSettings = (d.settings ?? {}) as Partial<Settings>;
  const settings: Settings = { ...defaultSettings(), ...oldSettings };
  const planDays = buildPlanDays(exercises);

  // A v1 day the user created outside the stock three survives, converted.
  const stock = new Set(["push", "pull", "legs"]);
  const oldDays = (Array.isArray(d.days) ? d.days : []) as Array<{
    id: string;
    name: string;
    exerciseIds?: string[];
  }>;
  const kept: DayTemplate[] = oldDays
    .filter((x) => !stock.has(x.id) && !planDays.some((p) => p.id === x.id))
    .map((x) => ({
      id: x.id,
      name: x.name,
      style: "strength",
      entries: (x.exerciseIds ?? []).map((exerciseId) => ({
        exerciseId,
        sets: settings.targetSets,
        reps: settings.targetReps,
      })),
      exerciseIds: [...(x.exerciseIds ?? [])],
    }));

  // Point v1 sessions at their current day type so progression and the cycle
  // can see pre-v2 history. dayName is left as it was logged.
  const DAY_REMAP: Record<string, string> = { push: "push-heavy", pull: "pull", legs: "legs-a" };
  const sessions = (d.sessions ?? []).map((s) =>
    DAY_REMAP[s.dayId] ? { ...s, dayId: DAY_REMAP[s.dayId] } : s
  );

  return normalize({
    version: 6,
    exercises,
    days: [...planDays, ...kept],
    rotation: planRotation(),
    planStart: PLAN_START,
    planUpdatedAt: 0,
    sessions,
    active: d.active ?? null,
    discardedActiveIds: [],
    settings,
    activities: [],
    health: emptyHealth(),
    coach: emptyCoach(),
    profile: emptyProfile(),
  });
}

export function emptyHealth(): HealthData {
  return { inbody: [], stepsWeekly: [], updatedAt: 0 };
}

export function emptyCoach(): CoachState {
  return { reviews: [], updatedAt: 0 };
}

export function emptyProfile(): ProfileData {
  return { goal: "", constraints: [], updatedAt: 0 };
}

/**
 * How far ahead of this device's clock a timestamp may sit before it's treated
 * as junk rather than skew. Generous on purpose: a genuinely mis-set phone
 * still merges normally, and only absurd values get pulled back.
 */
const MAX_CLOCK_SKEW_MS = 24 * 60 * 60 * 1000;

/** Generous for a one-line note, far short of anything that would bloat a push. */
const MAX_PROFILE_LINE = 400;
const MAX_PROFILE_CONSTRAINTS = 30;

/**
 * Timestamps decide who wins a merge (lib/merge.ts), so a blob carrying a
 * far-future stamp wins every comparison from now until that date — every real
 * edit afterwards is stamped Date.now(), loses, and silently reverts on every
 * device. Anything beyond the skew window is therefore rewritten to now, and
 * non-finite or missing values collapse to 0.
 */
function boundedStamp(value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  if (n > Date.now() + MAX_CLOCK_SKEW_MS) return Date.now();
  return Math.max(0, n);
}

/**
 * Fill in fields added to the v4 schema so an older stored blob loads cleanly,
 * and bound the timestamps sync resolves on. Every untrusted blob reaches state
 * through migrate(), so this is the one chokepoint covering localStorage, an
 * imported backup file, and a pulled cloud row alike.
 */
function normalize(d: AppData): AppData {
  const sessions = Array.isArray(d.sessions) ? d.sessions : [];
  for (const s of sessions) {
    if (s && s.updatedAt != null) s.updatedAt = boundedStamp(s.updatedAt);
  }
  const active = d.active ?? null;
  if (active && active.updatedAt != null) active.updatedAt = boundedStamp(active.updatedAt);

  const activities: Activity[] = Array.isArray(d.activities) ? d.activities : [];
  for (const a of activities) if (a) a.updatedAt = boundedStamp(a.updatedAt);

  const rawHealth = (d.health ?? {}) as Partial<HealthData>;
  const health: HealthData = {
    inbody: Array.isArray(rawHealth.inbody) ? rawHealth.inbody : [],
    stepsWeekly: Array.isArray(rawHealth.stepsWeekly) ? rawHealth.stepsWeekly : [],
    updatedAt: boundedStamp(rawHealth.updatedAt),
  };

  const rawCoach = (d.coach ?? {}) as Partial<CoachState>;
  const coach: CoachState = {
    reviews: Array.isArray(rawCoach.reviews) ? rawCoach.reviews : [],
    updatedAt: boundedStamp(rawCoach.updatedAt),
  };

  // Free text typed by hand and synced, so it gets the same treatment as any
  // other untrusted field: coerced to string, trimmed, and bounded in both
  // line length and count so a pasted wall of text can't bloat every push.
  const rawProfile = (d.profile ?? {}) as Partial<ProfileData>;
  const profile: ProfileData = {
    goal: typeof rawProfile.goal === "string" ? rawProfile.goal.slice(0, MAX_PROFILE_LINE) : "",
    constraints: (Array.isArray(rawProfile.constraints) ? rawProfile.constraints : [])
      .filter((c): c is string => typeof c === "string" && c.trim().length > 0)
      .map((c) => c.trim().slice(0, MAX_PROFILE_LINE))
      .slice(0, MAX_PROFILE_CONSTRAINTS),
    updatedAt: boundedStamp(rawProfile.updatedAt),
  };

  // Rebuilt field by field rather than passed through, so anything a hand-edited
  // backup file bolted onto the blob is dropped here instead of being persisted
  // and pushed to every other device.
  return {
    version: 6,
    exercises: d.exercises ?? {},
    days: Array.isArray(d.days) ? d.days : [],
    rotation: Array.isArray(d.rotation) && d.rotation.length ? d.rotation : planRotation(),
    planStart: typeof d.planStart === "string" ? d.planStart : PLAN_START,
    planUpdatedAt: boundedStamp(d.planUpdatedAt),
    sessions,
    active,
    discardedActiveIds: Array.isArray(d.discardedActiveIds) ? d.discardedActiveIds : [],
    settings: { ...defaultSettings(), ...(d.settings ?? {}) },
    activities,
    health,
    coach,
    profile,
  };
}
