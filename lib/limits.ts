/**
 * Bounds on an app blob, shared by the two places untrusted data enters:
 * the backup importer and the cloud pull. Postgres enforces its own 5 MB cap
 * (see app_data_size_cap in supabase-setup.sql); once a blob is over that, every
 * upsert fails and the merge only ever grows it, so sync would stay broken with
 * no way back. These limits keep an oversized blob from ever landing locally.
 */

/** Matches the CHECK constraint on app_data.data. */
export const MAX_BLOB_BYTES = 5 * 1024 * 1024;

/** Refuse an import at 4 MB so a later merge still has room to grow into the cap. */
export const MAX_IMPORT_BYTES = 4 * 1024 * 1024;

/** ~13 years of training at 6 sessions a week. A real blob is tens of KB. */
export const MAX_SESSIONS = 5000;

/**
 * Byte estimate of a blob once serialized. Uses string length rather than a
 * full TextEncoder pass because this runs on every sync; workout data is
 * effectively all ASCII, where the two agree, and any multi-byte name only
 * makes this an under-estimate against a cap we already sit 20% below.
 */
export function blobSize(data: unknown): number {
  try {
    return JSON.stringify(data).length;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}
