import type { AppData, DayTemplate, Exercise, MuscleGroup, PlanEntry, Settings } from "./types";

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
  };
}

export function planRotation(): string[] {
  return [...PLAN_ROTATION];
}

/**
 * Bring any stored blob up to the current schema. v1 stored three fixed
 * push/pull/legs templates with no per-exercise targets; v2 added targets plus
 * a 7-slot weekday schedule, which v3 flattens into an ordered cycle. Sessions,
 * exercises, and renames survive every step.
 */
export function migrate(raw: unknown): AppData {
  const d = raw as Partial<AppData> & {
    version?: number;
    days?: unknown;
    schedule?: (string | null)[];
  };
  if (d.version === 4) return d as AppData;

  if (d.version === 3) {
    const next = d as unknown as AppData;
    next.version = 4;
    next.planUpdatedAt = 0;
    return next;
  }

  if (d.version === 2) {
    const fromSchedule = (d.schedule ?? []).filter((x): x is string => Boolean(x));
    const next = d as unknown as AppData;
    next.rotation = fromSchedule.length ? fromSchedule : planRotation();
    next.version = 4;
    next.planUpdatedAt = 0;
    delete (next as { schedule?: unknown }).schedule;
    return next;
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

  return {
    version: 4,
    exercises,
    days: [...planDays, ...kept],
    rotation: planRotation(),
    planStart: PLAN_START,
    planUpdatedAt: 0,
    sessions,
    active: d.active ?? null,
    settings,
  };
}
