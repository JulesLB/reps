"use client";

import { useEffect, useState } from "react";
import { applyMerged, clearRescueSnapshot, getData, rescueSnapshot } from "@/lib/store";
import { mergeAppData } from "@/lib/merge";
import type { AppData } from "@/lib/types";

function describe(d: AppData) {
  const dates = [...new Set(d.sessions.map((s) => s.date))].sort();
  return {
    sessionCount: d.sessions.length,
    lastDate: dates[dates.length - 1] ?? "none logged",
    dayNames: d.days.map((x) => x.name).join(", "),
  };
}

/**
 * Surfaces the snapshot a sync overwrote, if one is still stashed locally
 * (see applyMerged in lib/store.ts). Restoring merges it back in rather than
 * replacing current state, so it can only add sessions/plan history back,
 * never drop anything logged since.
 */
export default function RecoverPanel() {
  const [rescue, setRescue] = useState<AppData | null>(null);
  const [current, setCurrent] = useState<AppData | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setRescue(rescueSnapshot());
    setCurrent(getData());
  }, []);

  if (!rescue || done) return null;

  const before = describe(rescue);
  const now = current ? describe(current) : null;
  const missing = now ? before.sessionCount - now.sessionCount : 0;

  const restore = () => {
    const boosted: AppData = { ...rescue, planUpdatedAt: Date.now() };
    const merged = mergeAppData(getData(), boosted);
    applyMerged(merged);
    clearRescueSnapshot();
    setDone(true);
  };

  const dismiss = () => {
    clearRescueSnapshot();
    setDone(true);
  };

  return (
    <div className="rounded-xl border border-warn/40 bg-warn/10 p-4">
      <span className="display mb-2 block text-sm font-bold uppercase tracking-wide text-warn">
        Backup found
      </span>
      <p className="mb-3 text-xs text-muted">
        Your last sync replaced local data. The version it replaced is still on this device:{" "}
        {before.sessionCount} session{before.sessionCount === 1 ? "" : "s"} (last logged{" "}
        {before.lastDate}), plan: {before.dayNames}.
        {now && missing > 0
          ? ` That's ${missing} more session${missing === 1 ? "" : "s"} than you have now.`
          : ""}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={restore}
          className="h-10 flex-1 rounded-lg bg-volt text-sm font-bold uppercase tracking-wide text-volt-ink"
        >
          Restore
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="h-10 rounded-lg border border-line px-3 text-sm font-semibold text-faint transition-colors duration-150 hover:text-warn"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
