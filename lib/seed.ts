import type { AppData, Exercise, MuscleGroup } from "./types";
import { buildPlanDays, defaultSettings, planRotation, PLAN_START } from "./plan";

const EXERCISES: Array<[string, string, MuscleGroup]> = [
  ["chest-press", "Chest Press Machine", "chest"],
  ["incline-db", "Incline Dumbbell Press", "chest"],
  ["shoulder-press", "Shoulder Press Machine", "shoulders"],
  ["lateral-raise", "Lateral Raise", "shoulders"],
  ["pec-fly", "Pec Fly Machine", "chest"],
  ["triceps-pushdown", "Triceps Pushdown", "triceps"],
  ["lat-pulldown", "Lat Pulldown", "back"],
  ["seated-row", "Seated Cable Row", "back"],
  ["chest-row", "Chest-Supported Row", "back"],
  ["face-pull", "Face Pull", "shoulders"],
  ["biceps-curl", "Biceps Curl", "biceps"],
  ["hammer-curl", "Hammer Curl", "biceps"],
  ["leg-press", "Leg Press", "quads"],
  ["smith-squat", "Smith Machine Squat", "quads"],
  ["leg-extension", "Leg Extension", "quads"],
  ["leg-curl", "Seated Leg Curl", "hamstrings"],
  ["hip-thrust", "Hip Thrust Machine", "glutes"],
  ["calf-raise", "Standing Calf Raise", "calves"],
  ["bike", "Stationary Bike", "cardio"],
];

export function emptyData(): AppData {
  const exercises: Record<string, Exercise> = {};
  for (const [id, name, muscle] of EXERCISES) exercises[id] = { id, name, muscle };
  return {
    version: 4,
    exercises,
    days: buildPlanDays(exercises),
    rotation: planRotation(),
    planStart: PLAN_START,
    planUpdatedAt: 0,
    sessions: [],
    active: null,
    settings: defaultSettings(),
  };
}
