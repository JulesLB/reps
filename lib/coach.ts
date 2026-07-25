import type {
  Activity,
  ActivityType,
  AppData,
  CoachReview,
  InBodyEntry,
  PlanChange,
} from "./types";
import { update } from "./store";
import { uid } from "./id";

export function latestReview(d: AppData): CoachReview | null {
  const r = d.coach.reviews;
  if (!r.length) return null;
  return r.reduce((best, x) => (x.generatedAt > best.generatedAt ? x : best), r[0]);
}

/** InBody scans oldest → newest. */
export function inbodySeries(d: AppData): InBodyEntry[] {
  return [...d.health.inbody].sort((a, b) => (a.date < b.date ? -1 : 1));
}

export interface ActivityInput {
  type: ActivityType;
  date: string;
  minutes: number;
  distanceKm?: number;
  elevationM?: number;
  note?: string;
}

export function addActivity(input: ActivityInput): void {
  const entry: Activity = { id: uid(), ...input, updatedAt: Date.now() };
  update((d) => {
    d.activities.push(entry);
    d.activities.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  });
}

export function deleteActivity(id: string): void {
  update((d) => {
    const a = d.activities.find((x) => x.id === id);
    if (a) {
      a.deleted = true;
      a.updatedAt = Date.now();
    }
  });
}

/** Live entries, newest first. */
export function recentActivities(d: AppData, limit: number): Activity[] {
  return d.activities
    .filter((a) => !a.deleted)
    .sort((a, b) => (a.date > b.date ? -1 : 1))
    .slice(0, limit);
}

export function latestStepWeek(d: AppData) {
  const w = d.health.stepsWeekly;
  if (!w.length) return null;
  return w.reduce((best, x) => (x.weekStart > best.weekStart ? x : best), w[0]);
}

/* ---- applying a recommendation ----------------------------------------- */

/**
 * Whether the plan already looks the way the change asks for. Derived from the
 * plan rather than stored as a flag on the review: it needs no extra slice to
 * sync, it can't drift out of step with the plan, and undoing the edit by hand
 * correctly makes the recommendation actionable again.
 */
export function changeApplied(d: AppData, c: PlanChange): boolean {
  const day = d.days.find((x) => x.id === c.dayId);
  if (!day) return false;
  const at = day.entries.findIndex((e) => e.exerciseId === c.exerciseId);
  switch (c.kind) {
    case "add":
      return at !== -1;
    case "remove":
      return at === -1;
    case "swap":
      return at !== -1 && !day.entries.some((e) => e.exerciseId === c.replacesId);
    case "target":
      if (at === -1) return false;
      return (
        (c.sets == null || day.entries[at].sets === c.sets) &&
        (c.reps == null || day.entries[at].reps === c.reps)
      );
    case "move":
      return at !== -1 && at === (c.position ?? 0);
    case "rename":
      return day.name === c.name;
  }
}

/** Whether the change references a day and exercises that still exist. */
export function changeUsable(d: AppData, c: PlanChange): boolean {
  const day = d.days.find((x) => x.id === c.dayId);
  if (!day) return false;
  if (c.kind === "rename") return Boolean(c.name?.trim());
  if (!c.exerciseId) return false;
  if (c.kind !== "remove" && !d.exercises[c.exerciseId]) return false;
  if (c.kind === "swap" && !c.replacesId) return false;
  // Reordering or retargeting something the day doesn't have yet would apply
  // silently to nothing. The button stays hidden until whichever recommendation
  // adds the exercise has been applied, so the two sequence themselves.
  if (c.kind === "move" || c.kind === "target")
    return day.entries.some((e) => e.exerciseId === c.exerciseId);
  return true;
}

/**
 * A day's name, made unique when it isn't. Duplicated templates are easy to end
 * up with — Jules ran two identical days both called "Legs" — and an apply
 * button that says "add this to Legs" when two Legs exist is a button nobody
 * should press. The suffix disappears on its own once one of them is renamed.
 */
export function dayLabel(d: AppData, dayId: string): string {
  const day = d.days.find((x) => x.id === dayId);
  if (!day) return "the plan";
  const sameName = d.days.filter((x) => x.name === day.name);
  if (sameName.length < 2) return day.name;
  return `${day.name} (${sameName.indexOf(day) + 1} of ${sameName.length})`;
}

/**
 * One plain sentence naming exactly what the tap will do. Built from the change
 * and the live plan rather than written into the review, so the confirmation can
 * never describe something different from what gets applied.
 */
export function describeChange(d: AppData, c: PlanChange): string {
  const dayName = dayLabel(d, c.dayId);
  const name = (id?: string) => (id && d.exercises[id]?.name) || "that exercise";
  const targets = c.sets != null && c.reps != null ? ` at ${c.sets}×${c.reps}` : "";
  switch (c.kind) {
    case "add":
      return `Add ${name(c.exerciseId)}${targets} to ${dayName}.`;
    case "remove":
      return `Remove ${name(c.exerciseId)} from ${dayName}.`;
    case "swap":
      return `Swap ${name(c.replacesId)} for ${name(c.exerciseId)}${targets} in ${dayName}.`;
    case "target":
      return `Set ${name(c.exerciseId)} to ${c.sets ?? "?"}×${c.reps ?? "?"} in ${dayName}.`;
    case "move":
      return `Move ${name(c.exerciseId)} to position ${(c.position ?? 0) + 1} in ${dayName}.`;
    case "rename":
      return `Rename "${dayName}" to "${c.name}".`;
  }
}

/**
 * Write the change into the plan. Idempotent — running it twice leaves the same
 * day — and it never touches logged sessions, only the template.
 */
export function applyChange(c: PlanChange): void {
  update((d) => {
    const day = d.days.find((x) => x.id === c.dayId);
    if (!day) return;
    if (c.kind === "rename") {
      if (c.name?.trim()) day.name = c.name.trim();
      return;
    }
    if (!c.exerciseId) return;
    const exerciseId = c.exerciseId;
    const sets = c.sets ?? d.settings.targetSets;
    const reps = c.reps ?? d.settings.targetReps;
    const at = day.entries.findIndex((e) => e.exerciseId === exerciseId);

    switch (c.kind) {
      case "add":
        if (at === -1) day.entries.push({ exerciseId, sets, reps });
        break;
      case "remove":
        if (at !== -1) day.entries.splice(at, 1);
        break;
      case "swap": {
        const old = day.entries.findIndex((e) => e.exerciseId === c.replacesId);
        if (at !== -1) {
          // Already in the day: keep it where it is and just drop the old one,
          // so a half-done swap finishes cleanly instead of duplicating a row.
          day.entries[at].sets = sets;
          day.entries[at].reps = reps;
          if (old !== -1) day.entries.splice(old, 1);
          break;
        }
        const entry = { exerciseId, sets, reps };
        // Takes the replaced exercise's slot, so the session order survives.
        if (old !== -1) day.entries.splice(old, 1, entry);
        else day.entries.push(entry);
        break;
      }
      case "target":
        if (at !== -1) {
          if (c.sets != null) day.entries[at].sets = c.sets;
          if (c.reps != null) day.entries[at].reps = c.reps;
        }
        break;
      case "move": {
        if (at === -1) break;
        const [entry] = day.entries.splice(at, 1);
        const to = Math.max(0, Math.min(c.position ?? 0, day.entries.length));
        day.entries.splice(to, 0, entry);
        break;
      }
    }
    day.exerciseIds = day.entries.map((e) => e.exerciseId);
  });
}

/* ---- profile ----------------------------------------------------------- */

export function setGoal(goal: string): void {
  update((d) => {
    d.profile.goal = goal.trim();
    d.profile.updatedAt = Date.now();
  });
}

export function addConstraint(text: string): void {
  const line = text.trim();
  if (!line) return;
  update((d) => {
    if (d.profile.constraints.includes(line)) return;
    d.profile.constraints.push(line);
    d.profile.updatedAt = Date.now();
  });
}

export function removeConstraint(index: number): void {
  update((d) => {
    if (index < 0 || index >= d.profile.constraints.length) return;
    d.profile.constraints.splice(index, 1);
    d.profile.updatedAt = Date.now();
  });
}
