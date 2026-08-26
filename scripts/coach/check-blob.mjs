// Read-only health check on the cloud blob: schema version, day count, and
// whether the active Hyrox cycle resolves. Touches nothing.
import { fetchSoleRow, loadEnv } from "./common.mjs";

const { blob } = await fetchSoleRow(loadEnv());
const ids = new Set(blob.days.map((d) => d.id));
const unresolved = (rot) => [...new Set((rot ?? []).map((s) => s.dayId).filter((d) => !ids.has(d)))];

console.log(
  JSON.stringify(
    {
      version: blob.version,
      days: blob.days.length,
      deletedDayIds: blob.deletedDayIds ?? "(field absent — still pre-v9)",
      gymCycleUnresolved: unresolved(blob.rotation),
      hyroxCycleUnresolved: unresolved(blob.hyroxRotation),
      sessions: (blob.sessions ?? []).length,
    },
    null,
    2
  )
);
