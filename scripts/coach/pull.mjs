// Pulls the full app blob from Supabase into Documents/coach/blob.json so the
// coach (Claude, running locally) can analyze it. Read-only against the cloud.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fetchSoleRow, loadEnv, WORK_DIR } from "./common.mjs";

const env = loadEnv();
const { userId, blob } = await fetchSoleRow(env);

mkdirSync(WORK_DIR, { recursive: true });
const out = join(WORK_DIR, "blob.json");
writeFileSync(out, JSON.stringify(blob, null, 2));

const sessions = blob.sessions ?? [];
const last = sessions[sessions.length - 1];
console.log(`wrote ${out}`);
console.log(
  JSON.stringify(
    {
      userId,
      version: blob.version,
      sessions: sessions.length,
      lastSession: last ? `${last.date} (${last.dayName})` : null,
      activities: (blob.activities ?? []).filter((a) => !a.deleted).length,
      inbodyScans: blob.health?.inbody?.length ?? 0,
      stepWeeks: blob.health?.stepsWeekly?.length ?? 0,
      reviews: blob.coach?.reviews?.length ?? 0,
    },
    null,
    2
  )
);
