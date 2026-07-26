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

/**
 * Standing context the coach has to respect on every review: what the training
 * is for, and the injuries/limits that rule certain advice out. Lives in the
 * blob rather than in the skill file so it syncs to the phone, survives a
 * reinstall, and can be edited from the Coach tab the moment something changes.
 */
export interface ProfileData {
  /** The goal in Jules's own words, e.g. "hold weight, grow legs". */
  goal: string;
  /** One line each: injuries, hard limits, anything that constrains the plan. */
  constraints: string[];
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

/**
 * A recommendation the app can carry out on its own, so acting on the review is
 * one tap instead of a trip through the plan editor. Deliberately narrow: only
 * changes to a day's exercise list and its set/rep targets, which is where most
 * coaching advice actually lands.
 */
export type PlanChangeKind = "add" | "remove" | "swap" | "target" | "move" | "rename";

export interface PlanChange {
  kind: PlanChangeKind;
  /** Day template the change applies to. */
  dayId: string;
  /** The exercise added, removed, moved, or retargeted. Absent on "rename". */
  exerciseId?: string;
  /** "swap" only: the exercise `exerciseId` takes the place of. */
  replacesId?: string;
  /** "add", "swap" and "target": the targets to write. */
  sets?: number;
  reps?: number;
  /** "move" only: zero-based position in the day's entry list. */
  position?: number;
  /** "rename" only: the day's new name. */
  name?: string;
}

export interface CoachRec {
  id: string;
  area: CoachArea;
  /** 1 = do this first, 3 = nice to have. */
  priority: 1 | 2 | 3;
  /** Short imperative, kept to a phone-friendly line. */
  title: string;
  /** One sentence carrying the number. Shown collapsed; `detail` is behind an expander. */
  tldr?: string;
  detail: string;
  dayId?: string;
  exerciseId?: string;
  /** Present when the app can apply this itself. */
  change?: PlanChange;
}

export interface CoachReview {
  id: string;
  generatedAt: number;
  /** ISO dates bounding the training window the review looked at. */
  periodFrom: string;
  periodTo: string;
  headline: string;
  /** 2-4 bullets, one line each. The whole review at a glance. */
  tldr?: string[];
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

/**
 * The schema version this build reads and writes. Sync compares it against the
 * raw version in a cloud blob before merging: a blob from the future means this
 * client is out of date, and an out-of-date client must never write — every
 * data-loss incident so far (three on 2026-07-25, one on 2026-07-26) was an old
 * cached bundle mangling a newer blob and pushing the wreckage.
 *
 * v7 changes nothing in the shape. It exists so the database-side version
 * floor (supabase-setup.sql) locks out every bundle shipped before the
 * server-side guard: their writes carry version <= 6 and are rejected at the
 * row, which is the one place a stale cached client can't dodge.
 */
export const CURRENT_VERSION = 7;

export interface AppData {
  version: 7;
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
  profile: ProfileData;
}
