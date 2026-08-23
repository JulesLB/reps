// Loads a training program (and optionally new day templates + a rotation)
// into the cloud blob. The program content itself is personal and lives in
// Documents/ (gitignored); this script is only the mechanism.
//
// Usage:
//   node scripts/coach/push-program.mjs [--program path] [--plan path]
//   node scripts/coach/push-program.mjs --dry out.json [--blob path]
//
// --program  ProgramData JSON (default Documents/coach/program.json)
// --plan     optional plan additions (default Documents/coach/plan-days.json):
//            { exercises?: [[id, name, muscle, rest?]...], days?: DayTemplate[],
//              rotation?: RotationStep[] }
//            Exercises are added only when missing (a rest override in the
//            tuple also fills in on an existing exercise that has none); days
//            upsert by id; the rotation, when present, replaces the GYM
//            cycle — phase cycles reach the Hyrox plan through the program,
//            never through this field.
// --dry      apply everything to a local blob file and write the result to
//            the given path instead of pushing. For testing a build before
//            it ships.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fail, fetchSoleRow, loadEnv, pushBlob, WORK_DIR } from "./common.mjs";

const args = process.argv.slice(2);
function argValue(flag, fallback) {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}
const programPath = argValue("--program", join(WORK_DIR, "program.json"));
const planPath = argValue("--plan", join(WORK_DIR, "plan-days.json"));
const dryOut = argValue("--dry", null);
const blobPath = argValue("--blob", join(WORK_DIR, "blob.json"));

function tryRead(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function validateRotation(rotation, knownDayIds, where) {
  if (!Array.isArray(rotation)) fail(`${where}: rotation must be an array`);
  rotation.forEach((s, i) => {
    if (!s || typeof s.dayId !== "string") fail(`${where}: rotation[${i}] needs a dayId`);
    if (!knownDayIds.has(s.dayId)) fail(`${where}: rotation[${i}].dayId "${s.dayId}" is not a known day`);
    if (i === 0 && s.withPrev) fail(`${where}: the first rotation step cannot carry withPrev`);
  });
}

function validateProgram(p, knownDayIds) {
  if (typeof p.name !== "string") fail("program needs a name string");
  if (!Array.isArray(p.events) || !Array.isArray(p.phases)) fail("program needs events[] and phases[]");
  for (const e of p.events) {
    if (!e.id || !e.name || !ISO.test(e.date ?? "")) fail(`event needs id, name, ISO date: ${JSON.stringify(e)}`);
  }
  for (const ph of p.phases) {
    if (!ph.id || !ph.name || !ISO.test(ph.from ?? ""))
      fail(`phase needs id, name, ISO from: ${JSON.stringify(ph).slice(0, 120)}`);
    if (typeof ph.focus !== "string" || !Array.isArray(ph.week))
      fail(`phase "${ph.id}" needs focus and week[]`);
    if (ph.rotation) validateRotation(ph.rotation, knownDayIds, `phase "${ph.id}"`);
  }
}

function applyPlan(blob, plan) {
  const summary = [];
  for (const [id, name, muscle, rest] of plan.exercises ?? []) {
    if (!id || !name || !muscle) fail(`plan exercise needs [id, name, muscle]: ${JSON.stringify([id, name, muscle])}`);
    if (!blob.exercises[id]) {
      blob.exercises[id] = { id, name, muscle, ...(rest > 0 ? { rest } : {}) };
      summary.push(`+exercise ${name}`);
    } else if (rest > 0 && !blob.exercises[id].rest) {
      // Fill a missing rest override, but never clobber one the user set.
      blob.exercises[id].rest = rest;
      summary.push(`~rest ${name} ${rest}s`);
    }
  }
  for (const day of plan.days ?? []) {
    if (!day.id || !day.name || !Array.isArray(day.entries)) fail(`plan day needs id, name, entries[]: ${day.id}`);
    for (const e of day.entries) {
      if (!blob.exercises[e.exerciseId]) fail(`day "${day.id}": exercise "${e.exerciseId}" does not exist`);
      if (!(e.sets > 0) || !(e.reps > 0)) fail(`day "${day.id}": entry ${e.exerciseId} needs sets and reps`);
      if (e.distanceM != null && !(e.distanceM > 0)) fail(`day "${day.id}": entry ${e.exerciseId} has a bad distanceM`);
    }
    const clean = {
      id: day.id,
      name: day.name,
      style: day.style === "cardio" ? "cardio" : "strength",
      ...(day.track === "hyrox" ? { track: "hyrox" } : {}),
      entries: day.entries,
      exerciseIds: day.entries.map((e) => e.exerciseId),
    };
    const i = blob.days.findIndex((d) => d.id === day.id);
    if (i === -1) {
      blob.days.push(clean);
      summary.push(`+day ${day.name}`);
    } else {
      blob.days[i] = clean;
      summary.push(`~day ${day.name}`);
    }
  }
  const knownDayIds = new Set(blob.days.map((d) => d.id));
  if (plan.rotation) {
    validateRotation(plan.rotation, knownDayIds, "plan");
    blob.rotation = plan.rotation;
    summary.push(`rotation → ${plan.rotation.length} steps`);
  }
  return summary;
}

const program = tryRead(programPath);
const plan = tryRead(planPath);
if (!program && !plan) fail(`nothing to push: neither ${programPath} nor ${planPath} is readable JSON`);

async function main() {
  let blob;
  let userId = null;
  let env = null;
  if (dryOut) {
    blob = tryRead(blobPath);
    if (!blob) fail(`--dry needs a readable blob at ${blobPath} (run pull.mjs first)`);
  } else {
    env = loadEnv();
    ({ userId, blob } = await fetchSoleRow(env));
    // A rotation of steps in a pre-v8 blob would break every live pre-v8
    // client (they treat rotation entries as strings). Never mix.
    if (!(blob.version >= 8))
      fail(`cloud blob is version ${blob.version}; deploy the v8 app and sync once before pushing a program`);
    // Local restore point no client bug can reach, alongside pull.mjs's.
    try {
      const dir = join(WORK_DIR, "snapshots");
      mkdirSync(dir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      writeFileSync(join(dir, `pre-program-${stamp}.json`), JSON.stringify(blob));
    } catch {
      // best effort only
    }
  }

  const summary = [];
  if (plan) summary.push(...applyPlan(blob, plan));
  if (program) {
    const knownDayIds = new Set(blob.days.map((d) => d.id));
    validateProgram(program, knownDayIds);
    blob.program = { ...program, updatedAt: Date.now() };
    summary.push(`program "${program.name}" (${program.phases.length} phases, ${program.events.length} events)`);
  }
  if (plan) blob.planUpdatedAt = Date.now();

  if (dryOut) {
    writeFileSync(dryOut, JSON.stringify(blob, null, 2));
    console.log(`dry run → ${dryOut}\n${summary.join("\n")}`);
  } else {
    await pushBlob(env, userId, blob);
    console.log(`pushed\n${summary.join("\n")}`);
  }
}

await main();
