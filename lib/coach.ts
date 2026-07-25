import type { Activity, ActivityType, AppData, CoachReview, InBodyEntry } from "./types";
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
