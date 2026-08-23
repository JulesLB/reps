"use client";

import { useEffect, useState } from "react";
import { getData, update } from "@/lib/store";
import { planSlice, planSnapshots, samePlanSlice, type PlanSnapshot } from "@/lib/planHistory";
import { asRotation } from "@/lib/plan";

function when(at: number): string {
  return new Date(at).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Every plan state this device has seen, newest first (lib/planHistory.ts).
 * Restoring adopts the snapshot as a fresh plan edit — stamped now via the
 * normal save() path — so it propagates like any deliberate change instead of
 * resurrecting stale timestamps the way the old rescue restore did.
 */
export default function PlanHistoryPanel() {
  const [snaps, setSnaps] = useState<PlanSnapshot[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setSnaps(planSnapshots());
  }, []);

  if (snaps.length < 2) return null;

  const current = planSlice(getData());

  const restore = (snap: PlanSnapshot) => {
    const names = snap.days.map((d) => d.name).join(", ");
    if (!confirm(`Restore this plan from ${when(snap.at)}?\n\n${names}\n\nYour logged sessions are not touched.`)) return;
    update((d) => {
      d.days = snap.days;
      // Snapshots taken before v8 store plain day-id strings.
      d.rotation = asRotation(snap.rotation);
      d.planStart = snap.planStart;
      // Union, snapshot winning conflicts: sessions logged since still resolve
      // their exercise ids, and the snapshot's names come back as they were.
      d.exercises = { ...d.exercises, ...snap.exercises };
      d.settings = snap.settings;
    });
    setSnaps(planSnapshots());
  };

  return (
    <div className="rounded-xl border border-line bg-surface-2 p-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between"
      >
        <span className="display text-sm font-bold uppercase tracking-wide">Plan history</span>
        <span className="text-xs font-semibold text-faint">{open ? "Hide" : `${snaps.length} saved`}</span>
      </button>
      {open && (
        <ul className="mt-3 space-y-2">
          {snaps.map((snap) => {
            const isCurrent = samePlanSlice(snap, current);
            return (
              <li
                key={snap.at}
                className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface p-3"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold">{when(snap.at)}</p>
                  <p className="truncate text-xs text-muted">
                    {snap.days.map((d) => d.name).join(", ")}
                  </p>
                </div>
                {isCurrent ? (
                  <span className="shrink-0 text-xs font-semibold text-volt">Current</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => restore(snap)}
                    className="h-9 shrink-0 rounded-lg border border-line px-3 text-xs font-bold uppercase tracking-wide transition-colors duration-150 hover:border-volt/40"
                  >
                    Restore
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
