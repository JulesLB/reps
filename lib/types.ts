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
  /**
   * When this session's contents last changed on some device. Lets the merge
   * pick the most recently edited copy of the *active* session, so deleting an
   * exercise (which lowers the logged-set count) sticks instead of losing to a
   * heavier pre-delete copy on the next sync. Absent on legacy blobs.
   */
  updatedAt?: number;
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
  /** Shorter rest for small, fast-recovering muscles (calves, lateral raises, abs). */
  restShort: number;
}

export type ActivityType = "hike" | "walk" | "run" | "other";

export interface Activity {
  id: string;
  type: ActivityType;
  /** ISO date (yyyy-mm-dd) the activity happened. */
  date: string;
  minutes: number;
  distanceKm?: number;
  elevationM?: number;
  note?: string;
  /**
   * Soft-delete flag. The merge unions activities by id, so a removed entry
   * has to keep existing with a fresher updatedAt or the other device's copy
   * resurrects it on the next sync.
   */
  deleted?: boolean;
  /** When this entry last changed on some device; drives the merge. */
  updatedAt: number;
}

/** Segmental lean mass as % of the ideal for each region, off the InBody sheet. */
export interface InBodySegmental {
  arms: number;
  trunk: number;
  legs: number;
}

export interface InBodyEntry {
  /** ISO date (yyyy-mm-dd) of the scan. */
  date: string;
  weightKg: number;
  /** Skeletal muscle mass. */
  smmKg: number;
  /** Percent body fat. */
  pbf: number;
  bodyFatKg?: number;
  bmi?: number;
  visceralFat?: number;
  score?: number;
  segmentalLean?: InBodySegmental;
}

export interface StepWeek {
  /** ISO date (yyyy-mm-dd) of the Monday starting the week. */
  weekStart: string;
  avgSteps: number;
  /** How many days of data the average covers. */
  days: number;
}

/**
 * Body metrics and activity data imported from outside the app (InBody scans,
 * Samsung Health exports). Written by the coach pipeline on the laptop, read
 * everywhere; last writer wins wholesale in the merge.
 */
export interface HealthData {
  inbody: InBodyEntry[];
  stepsWeekly: StepWeek[];
  updatedAt: number;
}

export type CoachArea =
  | "weight"
  | "reps"
  | "sets"
  | "exercise"
  | "sequencing"
  | "volume"
  | "balance"
  | "recovery";

export interface CoachRec {
  id: string;
  area: CoachArea;
  /** 1 = do this first, 3 = nice to have. */
  priority: 1 | 2 | 3;
  title: string;
  detail: string;
  dayId?: string;
  exerciseId?: string;
}

export interface CoachReview {
  id: string;
  generatedAt: number;
  /** ISO dates bounding the training window the review looked at. */
  periodFrom: string;
  periodTo: string;
  headline: string;
  summary: string;
  recommendations: CoachRec[];
  /** Things to keep an eye on rather than act on now. */
  watch?: string[];
}

/**
 * Reviews written by the coach (Claude running locally against the full
 * history). Single writer, so the merge resolves it by updatedAt wholesale.
 */
export interface CoachState {
  reviews: CoachReview[];
  updatedAt: number;
}

export interface AppData {
  version: 5;
  exercises: Record<string, Exercise>;
  days: DayTemplate[];
  /** Ordered training cycle of day ids; a day may appear more than once. */
  rotation: string[];
  /** ISO date of the start of plan week 1; drives rehab gates. */
  planStart: string;
  /**
   * When exercises/days/rotation/planStart/settings last changed, tracked
   * separately from session activity so sync can merge the two independently
   * — logging a workout must never make a stale plan edit look "newer".
   */
  planUpdatedAt: number;
  sessions: Session[];
  active: Session | null;
  /**
   * Ids of sessions cleared with Discard (which leave no finished record). A
   * bare `active: null` can't cross sync on its own — the merge treats a null
   * as "no opinion" and keeps the other device's active — so a discard is
   * recorded here and the merge drops any matching active. Finished sessions
   * need no entry: the merge already spots them in `sessions`.
   */
  discardedActiveIds: string[];
  settings: Settings;
  /** Hikes, walks, runs logged in-app. */
  activities: Activity[];
  health: HealthData;
  coach: CoachState;
}
