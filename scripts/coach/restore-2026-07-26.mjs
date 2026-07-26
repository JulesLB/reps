// One-off recovery for the 2026-07-26 wipe (incident #4): a pre-guard bundle
// ran the old v1 rebuild against the v6 blob and pushed the wreck (stock day
// names, planUpdatedAt 0, coach/health/profile emptied). Restores every slice
// from the last good pull (Documents/coach/blob.json, 2026-07-25 19:28 HKT)
// while keeping the session/activity union with the current cloud row, so the
// Pull logged on the morning of the 26th survives.
//
// Deliberately does NOT boost planUpdatedAt to "now": the good stamps already
// beat the wreck's zeros on every device, and a boosted restore stamp is what
// caused two earlier incidents.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fail, fetchSoleRow, loadEnv, pushBlob, WORK_DIR } from "./common.mjs";

const good = JSON.parse(readFileSync(join(WORK_DIR, "blob.json"), "utf8"));
if (!good.planUpdatedAt || !(good.coach?.reviews?.length >= 1) || !(good.health?.inbody?.length >= 1))
  fail("blob.json does not look like the good 2026-07-25 snapshot — aborting, nothing written");

const env = loadEnv();
const { userId, blob: cloud } = await fetchSoleRow(env);

const weight = (s) => (s.finishedAt ? 1_000_000 : 0) + s.logs.reduce((n, l) => n + l.sets.length, 0);
const sessions = new Map();
for (const s of good.sessions ?? []) sessions.set(s.id, s);
for (const s of cloud.sessions ?? []) {
  const prev = sessions.get(s.id);
  if (!prev || weight(s) >= weight(prev)) sessions.set(s.id, s);
}

const activities = new Map();
for (const a of good.activities ?? []) activities.set(a.id, a);
for (const a of cloud.activities ?? []) {
  const prev = activities.get(a.id);
  if (!prev || (a.updatedAt ?? 0) >= (prev.updatedAt ?? 0)) activities.set(a.id, a);
}

const restored = {
  version: 6,
  // Union so any exercise referenced by either side's sessions keeps resolving;
  // the good copy wins on conflict (it holds the real names).
  exercises: { ...(cloud.exercises ?? {}), ...(good.exercises ?? {}) },
  days: good.days,
  rotation: good.rotation,
  planStart: good.planStart,
  planUpdatedAt: good.planUpdatedAt,
  settings: good.settings,
  sessions: [...sessions.values()].sort((a, b) => a.startedAt - b.startedAt),
  active: cloud.active ?? null,
  discardedActiveIds: [...new Set([...(good.discardedActiveIds ?? []), ...(cloud.discardedActiveIds ?? [])])].slice(-50),
  activities: [...activities.values()],
  health: good.health,
  coach: good.coach,
  profile: good.profile,
};

await pushBlob(env, userId, restored);
console.log(JSON.stringify({
  days: restored.days.map((d) => d.name),
  rotation: restored.rotation,
  planUpdatedAt: restored.planUpdatedAt,
  sessions: restored.sessions.map((s) => `${s.date} ${s.dayName}`),
  reviews: restored.coach.reviews.length,
  inbody: restored.health.inbody.length,
  profileConstraints: restored.profile.constraints.length,
}, null, 2));
