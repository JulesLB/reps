// One-off recovery for the 2026-07-25 11:16 UTC plan wipe: a stale PWA tab on
// an old bundle saw the v6 blob, fell into migrate()'s v1 rebuild, and pushed
// the wreck. This writes the plan back exactly as it was at the 10:4x pull that
// preceded the wipe (captured in the session transcript), stamped now so it
// outvotes the wrecked copy still sitting in the phone's localStorage.
import { fail, fetchSoleRow, loadEnv, pushBlob } from "./common.mjs";

const DAYS = [
  { id: "push-heavy", name: "Push - Shoulder", style: "strength", entries: [
    ["chest-press", 3, 8], ["shoulder-press", 3, 8], ["c2w9v7g2", 3, 8],
    ["lateral-raise", 3, 8], ["triceps-pushdown", 3, 10], ["incline-db", 3, 8],
  ]},
  { id: "push-light", name: "Push - Chest", style: "strength", entries: [
    ["chest-press", 3, 12], ["shoulder-press", 3, 12], ["lateral-raise", 3, 15],
    ["pec-fly", 2, 15], ["6tbufurf", 3, 8], ["incline-db", 3, 12],
  ]},
  { id: "pull", name: "Pull", style: "strength", entries: [
    ["seated-row", 3, 10], ["lat-pulldown", 3, 10], ["ftx22ogx", 3, 8],
    ["uth0e3qk", 3, 8], ["biceps-curl", 3, 15], ["9kcpf6yp", 3, 12],
  ]},
  { id: "legs-a", name: "Legs", style: "strength", entries: [
    ["n6mkfef6", 4, 18], ["calf-raise", 3, 15], ["leg-extension", 3, 10],
    ["rwbxhsvk", 3, 9], ["leg-press", 3, 10], ["13x7tz3c", 3, 8],
  ]},
  { id: "5caoul9i", name: "Cardio Bike", style: "cardio", entries: [
    ["i18ccfhs", 3, 8],
  ]},
  { id: "o20x5g63", name: "Legs", style: "strength", entries: [
    ["n6mkfef6", 3, 18], ["calf-raise", 3, 15], ["leg-extension", 3, 10],
    ["rwbxhsvk", 3, 9], ["leg-press", 3, 10], ["13x7tz3c", 3, 8],
  ]},
];

const ROTATION = ["legs-a", "pull", "push-heavy", "o20x5g63", "pull", "push-light"];

const env = loadEnv();
const { userId, blob } = await fetchSoleRow(env);

for (const d of DAYS) {
  for (const [id] of d.entries) {
    if (!blob.exercises?.[id]) fail(`exercise ${id} missing from the blob — aborting, nothing written`);
  }
}

blob.days = DAYS.map((d) => ({
  id: d.id,
  name: d.name,
  style: d.style,
  entries: d.entries.map(([exerciseId, sets, reps]) => ({ exerciseId, sets, reps })),
  exerciseIds: d.entries.map(([exerciseId]) => exerciseId),
}));
blob.rotation = [...ROTATION];
blob.planUpdatedAt = Date.now();

await pushBlob(env, userId, blob);
console.log(`restored ${blob.days.length} days, rotation of ${blob.rotation.length}, planUpdatedAt ${blob.planUpdatedAt}`);
