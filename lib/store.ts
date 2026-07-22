"use client";

import { useEffect, useState } from "react";
import type { AppData } from "./types";
import { emptyData } from "./seed";
import { migrate } from "./plan";

const KEY = "gym-tracker-v1";
const CURRENT_VERSION = 4;
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
      const stale = parsed.version !== CURRENT_VERSION;
      data = migrate(parsed);
      lastPlanSig = planSignature(data);
      lastActiveSig = activeSignature(data);
      if (stale) save();
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

/**
 * Adopt an already-merged snapshot (lib/merge.ts) as local state. The version
 * being replaced is always stashed under RESCUE_KEY first, so a bad sync
 * stays recoverable. Writes the merge's own planUpdatedAt verbatim rather
 * than re-stamping it to now, so a plan edit's real timestamp survives
 * however many devices relay it.
 */
export function applyMerged(next: AppData): void {
  try {
    const current = localStorage.getItem(KEY);
    if (current) localStorage.setItem(RESCUE_KEY, current);
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
