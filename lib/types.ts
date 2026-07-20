export type MuscleGroup =
  | "chest"
  | "back"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "core"
  | "cardio"
  | "other";

export interface Exercise {
  id: string;
  name: string;
  muscle: MuscleGroup;
  /** Rest override in seconds; when unset, rest comes from compound/isolation defaults. */
  rest?: number;
}

export type DayStyle = "strength" | "cardio";

export interface PlanEntry {
  exerciseId: string;
  sets: number;
  reps: number;
  /** Coaching cue shown on the exercise card ("control the eccentric"). */
  note?: string;
  /** Ramp-up gate: the exercise only appears from this plan week onward. */
  fromWeek?: number;
}

export interface DayTemplate {
  id: string;
  name: string;
  style: DayStyle;
  entries: PlanEntry[];
  /** Mirror of entries, kept so a device still on the v1 build doesn't crash on a synced blob. */
  exerciseIds: string[];
}

export interface SetLog {
  weight: number;
  reps: number;
  done: boolean;
  warmup?: boolean;
}

export interface CardioLog {
  minutes: number;
  level: number;
  done: boolean;
}

export interface ExerciseLog {
  exerciseId: string;
  sets: SetLog[];
  /** Snapshot of the day's plan targets when the session was built. */
  targetSets?: number;
  targetReps?: number;
  note?: string;
  cardio?: CardioLog;
}

export interface Session {
  id: string;
  dayId: string;
  dayName: string;
  style?: DayStyle;
  /** Position in the rotation this session occupied, so the cycle survives duplicates. */
  rotationIndex?: number;
  date: string;
  startedAt: number;
  finishedAt?: number;
  logs: ExerciseLog[];
}

export interface Settings {
  unit: "kg" | "lb";
  increment: number;
  targetSets: number;
  targetReps: number;
  /** Default rest in seconds by exercise class. */
  restCompound: number;
  restIsolation: number;
}

export interface AppData {
  version: 3;
  exercises: Record<string, Exercise>;
  days: DayTemplate[];
  /** Ordered training cycle of day ids; a day may appear more than once. */
  rotation: string[];
  /** ISO date of the start of plan week 1; drives rehab gates. */
  planStart: string;
  sessions: Session[];
  active: Session | null;
  settings: Settings;
}
