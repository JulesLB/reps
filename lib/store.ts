"use client";

import { useEffect, useState } from "react";
import type { AppData } from "./types";
import { emptyData } from "./seed";
import { migrate } from "./plan";

const KEY = "gym-tracker-v1";
const CURRENT_VERSION = 3;
const STAMP_KEY = "gym-tracker-updated-at";
const RESCUE_KEY = "gym-tracker-rescue";

let data: AppData | null = null;
const listeners = new Set<() => void>();
const changeListeners = new Set<(source: "local" | "remote") => void>();

function load(): AppData {
  if (data) return data;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { version?: number };
      const stale = parsed.version !== CURRENT_VERSION;
      data = migrate(parsed);
      if (stale) save();
      return data;
    }
  } catch {
    // corrupted storage: start fresh
  }
  data = emptyData();
  save();
  return data;
}

// Ask the browser not to evict this origin's storage under pressure.
function requestPersistence(): void {
  navigator.storage?.persist?.().catch(() => {});
}

function save(): void {
  if (!data) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    localStorage.setItem(STAMP_KEY, String(Date.now()));
  } catch {
    // storage full or unavailable; keep in-memory state
  }
}

export function update(fn: (d: AppData) => void): void {
  const d = load();
  fn(d);
  save();
  listeners.forEach((l) => l());
  changeListeners.forEach((l) => l("local"));
}

export function useAppData(): AppData | null {
  const [snap, setSnap] = useState<AppData | null>(null);
  useEffect(() => {
    setSnap({ ...load() });
    requestPersistence();
    const l = () => setSnap({ ...load() });
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return snap;
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

/* ---- sync support ------------------------------------------------------ */

export function getData(): AppData {
  return load();
}

export function localStamp(): number {
  const raw = localStorage.getItem(STAMP_KEY);
  return raw ? Number(raw) || 0 : 0;
}

/** True when nothing has been logged yet, so overwriting costs nothing. */
export function isPristine(d: AppData = load()): boolean {
  return d.sessions.length === 0 && !d.active;
}

/**
 * Overwrite local state with a remote snapshot. The version being replaced is
 * always stashed under RESCUE_KEY first, so a bad sync is recoverable.
 */
export function replaceAll(next: AppData, stamp: number): void {
  try {
    const current = localStorage.getItem(KEY);
    if (current) localStorage.setItem(RESCUE_KEY, current);
  } catch {
    // best effort only
  }
  data = migrate(next);
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    localStorage.setItem(STAMP_KEY, String(stamp));
  } catch {
    // keep in-memory state
  }
  listeners.forEach((l) => l());
  changeListeners.forEach((l) => l("remote"));
}

export function onChange(cb: (source: "local" | "remote") => void): () => void {
  changeListeners.add(cb);
  return () => {
    changeListeners.delete(cb);
  };
}

/** The snapshot displaced by the last replaceAll, if any. */
export function rescueSnapshot(): AppData | null {
  try {
    const raw = localStorage.getItem(RESCUE_KEY);
    return raw ? (JSON.parse(raw) as AppData) : null;
  } catch {
    return null;
  }
}
