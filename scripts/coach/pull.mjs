// Pulls the full app blob from Supabase into Documents/coach/blob.json so the
// coach (Claude, running locally) can analyze it. Read-only against the cloud.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fetchSoleRow, loadEnv, WORK_DIR } from "./common.mjs";

/** Timestamped copies kept per pull; ~40 covers weeks of history at trivial disk cost. */
const MAX_SNAPSHOTS = 40;

const env = loadEnv();
const { userId, blob } = await fetchSoleRow(env);

mkdirSync(WORK_DIR, { recursive: true });
const out = join(WORK_DIR, "blob.json");
writeFileSync(out, JSON.stringify(blob, null, 2));

// Every pull also lands a timestamped snapshot. A bad client can wreck the
// cloud row and every phone at once (it did, 2026-07-25 — three times), but it
// can't reach this folder, so the newest good copy is always one `ls` away.
const snapDir = join(WORK_DIR, "snapshots");
mkdirSync(snapDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
writeFileSync(join(snapDir, `blob-${stamp}.json`), JSON.stringify(blob));
const snaps = readdirSync(snapDir).filter((f) => f.startsWith("blob-")).sort();
for (const old of snaps.slice(0, Math.max(0, snaps.length - MAX_SNAPSHOTS))) {
  rmSync(join(snapDir, old));
}

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
