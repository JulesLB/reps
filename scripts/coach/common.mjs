import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const WORK_DIR = join(ROOT, "Documents", "coach");

export function loadEnv() {
  const env = {};
  const raw = readFileSync(join(ROOT, ".env.local"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) fail("NEXT_PUBLIC_SUPABASE_URL missing from .env.local");
  if (!key)
    fail(
      "SUPABASE_SERVICE_ROLE_KEY missing from .env.local. Add it from the Supabase dashboard: Project Settings > API > service_role."
    );
  return { url: url.replace(/\/$/, ""), key, email: env.COACH_USER_EMAIL ?? "jules2lebreton@gmail.com" };
}

export function fail(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

async function request(env, path, options = {}) {
  const res = await fetch(`${env.url}${path}`, {
    ...options,
    headers: {
      apikey: env.key,
      Authorization: `Bearer ${env.key}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) fail(`${path} -> ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

/**
 * This is a single-user app: rather than resolve an email to a user id
 * through the Auth Admin API (which the newer sb_secret_ key format doesn't
 * cleanly support), read the table directly — the service key bypasses RLS,
 * so this returns every row. Exactly one is expected; more than one means a
 * stranger signed up and wrote their own row, which is worth stopping and
 * surfacing rather than silently picking one.
 */
export async function fetchSoleRow(env) {
  const rows = await request(env, "/rest/v1/app_data?select=user_id,data");
  if (!rows.length) fail("no app_data rows found — sync from the app at least once first");
  if (rows.length > 1)
    fail(
      `found ${rows.length} app_data rows, expected 1. Someone else may have signed up. Not proceeding automatically — check the Supabase table.`
    );
  return { userId: rows[0].user_id, blob: rows[0].data };
}

export async function pushBlob(env, userId, data) {
  await request(env, `/rest/v1/app_data?user_id=eq.${userId}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ data, updated_at: new Date().toISOString() }),
  });
}
