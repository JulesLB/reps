"use client";

import { useEffect, useState } from "react";
import type { AppData } from "./types";
import { emptyData } from "./seed";
import { migrate } from "./plan";

const KEY = "gym-tracker-v1";
const STAMP_KEY = "gym-tracker-updated-at";
const RESCUE_KEY = "gym-tracker-rescue";

let data: AppData | null = null;
let lastPlanSig: string | null = null;
let lastActiveSig: string | null = null;
const listeners = new Set<() => void>();
const changeListeners = new Set<(source: "local" | "remote") => void>();

/** Fingerprint of the plan-only slice of AppData, used to detect a genuine plan edit. */
function planSignature(d: AppData): string {
  return JSON.stringify({
    exercises: d.exercises,
    days: d.days,
    rotation: d.rotation,
    planStart: d.planStart,
    settings: d.settings,
  });
}

/** Fingerprint of the active session's contents, ignoring its own updatedAt stamp. */
function activeSignature(d: AppData): string {
  if (!d.active) return "";
  const { updatedAt: _ignored, ...rest } = d.active;
  return JSON.stringify(rest);
}

function load(): AppData {
  if (data) return data;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { version?: number };
      data = migrate(parsed);
      lastPlanSig = planSignature(data);
      lastActiveSig = activeSignature(data);
      // Write back whenever migrate() changed anything, not just on a version
      // bump. An out-of-range timestamp or a field migrate() stripped would
      // otherwise sit in storage indefinitely, sanitized on every read but
      // never actually cleaned. migrate() rebuilds the blob in a fixed key
      // order, so once written this comparison settles and stops re-saving.
      if (JSON.stringify(data) !== raw) save();
      return data;
    }
  } catch {
    // corrupted storage: start fresh
  }
  data = emptyData();
  lastPlanSig = planSignature(data);
  lastActiveSig = activeSignature(data);
  save();
  return data;
}

// Ask the browser not to evict this origin's storage under pressure.
function requestPersistence(): void {
  navigator.storage?.persist?.().catch(() => {});
}

/**
 * Persist a local edit. Bumps planUpdatedAt only when the plan-only slice
 * actually changed, so sync can tell a plan edit apart from ordinary session
 * activity (see lib/merge.ts).
 */
/**
 * Set when a write to localStorage fails, almost always a full quota. Until it
 * clears, logged sets live only in memory and are gone on reload, so this has
 * to reach the UI instead of being swallowed (see components/StorageWarning).
 */
let storageBroken = false;

export function storageFailed(): boolean {
  return storageBroken;
}

function save(): void {
  if (!data) return;
  try {
    const sig = planSignature(data);
    if (sig !== lastPlanSig) {
      lastPlanSig = sig;
      data.planUpdatedAt = Date.now();
    }
    const asig = activeSignature(data);
    if (asig !== lastActiveSig) {
      lastActiveSig = asig;
      if (data.active) data.active.updatedAt = Date.now();
    }
    localStorage.setItem(KEY, JSON.stringify(data));
    localStorage.setItem(STAMP_KEY, String(Date.now()));
    storageBroken = false;
  } catch {
    // Storage full or unavailable. In-memory state stands so the workout can
    // continue, but the user has to know this device is no longer persisting.
    storageBroken = true;
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

export { uid } from "./id";

/* ---- sync support ------------------------------------------------------ */

export function getData(): AppData {
  return load();
}

/**
 * Adopt an already-merged snapshot (lib/merge.ts) as local state. The version
 * being replaced is always stashed under RESCUE_KEY first, so a bad sync
 * stays recoverable. Writes the merge's own planUpdatedAt verbatim rather
 * than re-stamping it to now, so a plan edit's real timestamp survives
 * however many devices relay it.
 */
/** Would adopting `next` drop a session or change the plan that `prev` had? */
function isLossy(prev: AppData, next: AppData): boolean {
  const keptIds = new Set(next.sessions.map((s) => s.id));
  if (prev.sessions.some((s) => !keptIds.has(s.id))) return true;
  return planSignature(prev) !== planSignature(next);
}

export function applyMerged(next: AppData): void {
  // Only keep a rescue copy when the merge actually takes something away. Since
  // mergeAppData unions sessions by id it almost never does, so stashing on
  // every pull just doubled this origin's storage for nothing — and storage
  // running out is itself a silent data-loss path (see save()).
  try {
    const current = localStorage.getItem(KEY);
    if (current && data && isLossy(data, next)) {
      localStorage.setItem(RESCUE_KEY, current);
    }
  } catch {
    // best effort only
  }
  data = next;
  lastPlanSig = planSignature(data);
  lastActiveSig = activeSignature(data);
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    localStorage.setItem(STAMP_KEY, String(Date.now()));
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

/** The snapshot displaced by the last applyMerged call, if any. */
export function rescueSnapshot(): AppData | null {
  try {
    const raw = localStorage.getItem(RESCUE_KEY);
    return raw ? migrate(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function clearRescueSnapshot(): void {
  try {
    localStorage.removeItem(RESCUE_KEY);
  } catch {
    // ignore
  }
}
