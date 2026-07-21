"use client";

import type { AppData } from "./types";
import { applyMerged, getData, onChange } from "./store";
import { mergeAppData, sameAppData } from "./merge";
import { supabase, syncEnabled } from "./supabase";

export type SyncState = "off" | "signed-out" | "idle" | "syncing" | "error" | "offline";

async function fetchRemote(userId: string): Promise<AppData | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data: row, error } = await sb
    .from("app_data")
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return row ? (row.data as AppData) : null;
}

async function pushRemote(userId: string, payload: AppData): Promise<void> {
  const sb = supabase();
  if (!sb) return;
  const { error } = await sb
    .from("app_data")
    .upsert({ user_id: userId, data: payload, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/**
 * The one place that talks to the cloud. Always fetches remote, merges it
 * with local (lib/merge.ts), applies the merge locally if it added anything,
 * and pushes the merge back if it added anything the cloud didn't have. Never
 * a blind push of raw local state, never a blind overwrite of local state —
 * that combination is what let a stale browser tab clobber newer phone data
 * on 2026-07-21.
 */
async function syncOnce(userId: string): Promise<"pushed" | "pulled" | "noop"> {
  const local = getData();
  const remote = await fetchRemote(userId);
  if (!remote) {
    await pushRemote(userId, local);
    return "pushed";
  }

  const merged = mergeAppData(local, remote);
  const localChanged = !sameAppData(merged, local);
  const remoteChanged = !sameAppData(merged, remote);

  if (localChanged) applyMerged(merged);
  if (remoteChanged) await pushRemote(userId, merged);

  if (!localChanged && !remoteChanged) return "noop";
  return localChanged ? "pulled" : "pushed";
}

// Serialize every sync attempt so overlapping triggers (a focus event landing
// mid-debounce, say) can't race each other against the same remote row.
let inFlight: Promise<"pushed" | "pulled" | "noop"> = Promise.resolve("noop");

function runSync(userId: string): Promise<"pushed" | "pulled" | "noop"> {
  const next = inFlight.catch(() => "noop" as const).then(() => syncOnce(userId));
  inFlight = next;
  return next;
}

export async function reconcile(userId: string): Promise<"pushed" | "pulled" | "noop"> {
  return runSync(userId);
}

let timer: ReturnType<typeof setTimeout> | null = null;
let dirty = false;

/** Debounced sync, so tapping through a set doesn't fire a request per tap. */
function scheduleSync(userId: string, onState: (s: SyncState) => void): void {
  dirty = true;
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    if (!dirty) return;
    dirty = false;
    onState("syncing");
    try {
      await runSync(userId);
      onState("idle");
    } catch {
      dirty = true;
      onState(navigator.onLine ? "error" : "offline");
    }
  }, 2500);
}

export function startSync(userId: string, onState: (s: SyncState) => void): () => void {
  if (!syncEnabled) {
    onState("off");
    return () => {};
  }

  let stopped = false;

  const syncNow = async () => {
    if (stopped) return;
    onState("syncing");
    try {
      await runSync(userId);
      onState("idle");
    } catch {
      onState(navigator.onLine ? "error" : "offline");
    }
  };

  const unsubscribe = onChange((source) => {
    if (source === "local") scheduleSync(userId, onState);
  });

  const onFocus = () => void syncNow();
  const onOnline = () => {
    if (dirty) scheduleSync(userId, onState);
    else void syncNow();
  };
  // visibilitychange, not just window focus: switching into a background tab
  // does not reliably fire a window "focus" event in most browsers, which is
  // exactly how a stale tab went unreconciled on 2026-07-21.
  const onVisible = () => {
    if (document.visibilityState === "visible") void syncNow();
    else if (dirty) void syncNow(); // best-effort flush when backgrounding mid-workout
  };

  window.addEventListener("focus", onFocus);
  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onVisible);

  return () => {
    stopped = true;
    unsubscribe();
    window.removeEventListener("focus", onFocus);
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onVisible);
    if (timer) clearTimeout(timer);
  };
}
