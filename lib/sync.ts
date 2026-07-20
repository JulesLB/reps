"use client";

import type { AppData } from "./types";
import { getData, isPristine, localStamp, onChange, replaceAll } from "./store";
import { supabase, syncEnabled } from "./supabase";

export type SyncState = "off" | "signed-out" | "idle" | "syncing" | "error" | "offline";

interface Remote {
  data: AppData;
  stamp: number;
}

async function fetchRemote(userId: string): Promise<Remote | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data: row, error } = await sb
    .from("app_data")
    .select("data, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!row) return null;
  return { data: row.data as AppData, stamp: new Date(row.updated_at as string).getTime() };
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
 * Decides what happens the first time a device meets the cloud.
 *
 * The rule that matters: a device holding real sessions never gets silently
 * overwritten by an emptier cloud. That is the migration case, phone full and
 * cloud blank, and getting it backwards would lose everything.
 */
export async function reconcile(userId: string): Promise<"pushed" | "pulled" | "noop"> {
  const local = getData();
  const remote = await fetchRemote(userId);

  if (!remote) {
    await pushRemote(userId, local);
    return "pushed";
  }

  const localEmpty = isPristine(local);
  const remoteEmpty = isPristine(remote.data);

  if (localEmpty && !remoteEmpty) {
    replaceAll(remote.data, remote.stamp);
    return "pulled";
  }

  if (!localEmpty && remoteEmpty) {
    await pushRemote(userId, local);
    return "pushed";
  }

  if (localEmpty && remoteEmpty) return "noop";

  // Both hold real data: newer wins, and replaceAll keeps the loser recoverable.
  if (remote.stamp > localStamp()) {
    replaceAll(remote.data, remote.stamp);
    return "pulled";
  }
  await pushRemote(userId, local);
  return "pushed";
}

let timer: ReturnType<typeof setTimeout> | null = null;
let pending = false;

/** Debounced push, so tapping through a set doesn't fire a request per tap. */
function schedulePush(userId: string, onState: (s: SyncState) => void): void {
  pending = true;
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    if (!pending) return;
    pending = false;
    onState("syncing");
    try {
      await pushRemote(userId, getData());
      onState("idle");
    } catch {
      pending = true;
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

  const pullIfNewer = async () => {
    if (stopped) return;
    try {
      const remote = await fetchRemote(userId);
      if (remote && remote.stamp > localStamp() && !pending) {
        replaceAll(remote.data, remote.stamp);
      }
      onState("idle");
    } catch {
      onState(navigator.onLine ? "error" : "offline");
    }
  };

  const unsubscribe = onChange((source) => {
    if (source === "local") schedulePush(userId, onState);
  });

  const onFocus = () => void pullIfNewer();
  const onOnline = () => {
    if (pending) schedulePush(userId, onState);
    void pullIfNewer();
  };

  window.addEventListener("focus", onFocus);
  window.addEventListener("online", onOnline);

  // Best-effort flush when the app goes to the background mid-workout.
  const onHide = () => {
    if (document.visibilityState === "hidden" && pending) {
      const sb = supabase();
      if (sb) void pushRemote(userId, getData()).catch(() => {});
    }
  };
  document.addEventListener("visibilitychange", onHide);

  return () => {
    stopped = true;
    unsubscribe();
    window.removeEventListener("focus", onFocus);
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onHide);
    if (timer) clearTimeout(timer);
  };
}
