// Writes a coach review and/or refreshed health data into the cloud blob.
// Re-fetches the row immediately before writing and only touches the coach and
// health slices, so sessions logged on the phone in the meantime survive.
//
// Usage: node scripts/coach/push.mjs [--review path] [--health path]
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fail, fetchSoleRow, loadEnv, pushBlob, WORK_DIR } from "./common.mjs";

const MAX_REVIEWS = 6;

const args = process.argv.slice(2);
function argPath(flag, fallback) {
  const i = args.indexOf(flag);
  if (i !== -1 && args[i + 1]) return args[i + 1];
  return fallback;
}
const reviewPath = argPath("--review", join(WORK_DIR, "review.json"));
const healthPath = argPath("--health", join(WORK_DIR, "health.json"));
const profilePath = argPath("--profile", join(WORK_DIR, "profile.json"));

function tryRead(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

const review = tryRead(reviewPath);
const health = tryRead(healthPath);
const profile = tryRead(profilePath);
if (!review && !health && !profile)
  fail(`nothing to push: none of ${reviewPath}, ${healthPath}, ${profilePath} is readable JSON`);

const AREAS = new Set(["weight", "reps", "sets", "exercise", "sequencing", "volume", "balance", "recovery"]);

function validateReview(r) {
  if (!r.headline || !r.summary) fail("review needs headline and summary");
  if (!Array.isArray(r.recommendations) || !r.recommendations.length)
    fail("review needs a recommendations array");
  for (const rec of r.recommendations) {
    if (!rec.title || !rec.detail) fail(`recommendation missing title/detail: ${JSON.stringify(rec)}`);
    if (!AREAS.has(rec.area)) fail(`recommendation area "${rec.area}" not in ${[...AREAS].join(", ")}`);
    if (![1, 2, 3].includes(rec.priority)) fail(`recommendation priority must be 1, 2 or 3`);
    rec.id ??= `${rec.area}-${Math.random().toString(36).slice(2, 8)}`;
  }
  r.id ??= `review-${new Date().toISOString().slice(0, 10)}`;
  r.generatedAt ??= Date.now();
  r.periodFrom ??= "";
  r.periodTo ??= "";
  return r;
}

function validateHealth(h) {
  if (!Array.isArray(h.inbody) || !Array.isArray(h.stepsWeekly))
    fail("health needs inbody[] and stepsWeekly[]");
  return h;
}

/**
 * The app owns this slice — it's edited from the Coach tab. The pipeline only
 * writes it to seed a constraint learned in conversation, so it merges into
 * whatever is already there rather than replacing it, and never drops a line
 * Jules added on his phone.
 */
function mergeProfile(existing, incoming) {
  if (typeof incoming.goal !== "string" || !Array.isArray(incoming.constraints))
    fail("profile needs a goal string and a constraints array");
  const constraints = [...(existing?.constraints ?? [])];
  for (const c of incoming.constraints) {
    if (typeof c === "string" && c.trim() && !constraints.includes(c.trim())) constraints.push(c.trim());
  }
  return { goal: incoming.goal.trim() || (existing?.goal ?? ""), constraints };
}

const env = loadEnv();
const { userId, blob } = await fetchSoleRow(env);
const now = Date.now();

if (review) {
  const v = validateReview(review);
  const kept = (blob.coach?.reviews ?? []).filter((r) => r.id !== v.id);
  kept.push(v);
  kept.sort((a, b) => a.generatedAt - b.generatedAt);
  blob.coach = { reviews: kept.slice(-MAX_REVIEWS), updatedAt: now };
}

if (health) {
  blob.health = { ...validateHealth(health), updatedAt: now };
}

if (profile) {
  blob.profile = { ...mergeProfile(blob.profile, profile), updatedAt: now };
}

await pushBlob(env, userId, blob);
console.log(
  `pushed${review ? ` review "${review.headline}"` : ""}` +
    `${health ? ` + health (${health.inbody.length} scans, ${health.stepsWeekly.length} step weeks)` : ""}` +
    `${profile ? ` + profile (${blob.profile.constraints.length} constraints)` : ""}`
);
