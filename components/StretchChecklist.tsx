"use client";

import { useEffect, useState } from "react";
import type { StretchRoutine } from "@/lib/stretches";
import { CheckIcon, ClockIcon } from "./icons";

interface ActiveHold {
  index: number;
  endsAt: number;
}

/**
 * Post-session stretch checklist. Each tap starts one timed hold; the buzz
 * matches the rest timer so the phone can stay in a pocket. Progress is
 * component state only — nothing here touches the blob.
 */
export default function StretchChecklist({ routine }: { routine: StretchRoutine }) {
  const [done, setDone] = useState<number[]>(() => routine.items.map(() => 0));
  const [hold, setHold] = useState<ActiveHold | null>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    setDone(routine.items.map(() => 0));
    setHold(null);
  }, [routine]);

  // Re-render while a hold counts down.
  useEffect(() => {
    if (!hold) return;
    const t = setInterval(() => tick((x) => x + 1), 500);
    return () => clearInterval(t);
  }, [hold]);

  // Buzz and credit the hold when it runs out (same pattern as the rest timer).
  useEffect(() => {
    if (!hold) return;
    const ms = Math.max(0, hold.endsAt - Date.now());
    const t = setTimeout(() => {
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([180, 90, 180]);
      setDone((d) => d.map((v, i) => (i === hold.index ? Math.min(routine.items[i].holds, v + 1) : v)));
      setHold(null);
    }, ms);
    return () => clearTimeout(t);
  }, [hold, routine]);

  const tap = (index: number) => {
    const item = routine.items[index];
    if (hold?.index === index) {
      // End early, still counts: you decide when the hold is over.
      setDone((d) => d.map((v, i) => (i === index ? Math.min(item.holds, v + 1) : v)));
      setHold(null);
      return;
    }
    if (done[index] >= item.holds) {
      setDone((d) => d.map((v, i) => (i === index ? 0 : v)));
      return;
    }
    setHold({ index, endsAt: Date.now() + item.seconds * 1000 });
  };

  const allDone = routine.items.every((item, i) => done[i] >= item.holds);
  const remaining = hold ? Math.max(0, Math.ceil((hold.endsAt - Date.now()) / 1000)) : 0;

  return (
    <div className="rounded-2xl border border-line-soft bg-surface p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="display text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          {routine.title} · ~{routine.minutes} min
        </p>
        {allDone && (
          <span className="flex items-center gap-1 text-xs font-semibold text-volt">
            <CheckIcon className="h-3.5 w-3.5" /> Stretched
          </span>
        )}
      </div>
      <p className="mt-0.5 text-[11px] text-faint">
        Tap to start a hold · tap again to end it early · mild tension, never pain
      </p>

      <div className="mt-3 space-y-2">
        {routine.items.map((item, i) => {
          const complete = done[i] >= item.holds;
          const active = hold?.index === i;
          return (
            <button
              key={item.name}
              type="button"
              aria-label={
                complete
                  ? `Reset ${item.name}`
                  : active
                    ? `End ${item.name} hold early`
                    : `Start a ${item.seconds} second ${item.name} hold`
              }
              onClick={() => tap(i)}
              className={`w-full rounded-xl border p-3 text-left transition-colors duration-150 ${
                active
                  ? "border-volt/50 bg-volt/10"
                  : complete
                    ? "border-line-soft bg-surface-2 opacity-70"
                    : "border-line-soft bg-surface-2"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className={`font-semibold ${complete ? "text-muted line-through" : ""}`}>{item.name}</p>
                  <p className="text-xs text-muted">{item.detail}</p>
                  {item.caution && <p className="mt-0.5 text-[11px] text-amber/80">{item.caution}</p>}
                </div>
                {active ? (
                  <span className="num display shrink-0 text-2xl font-bold text-volt">{remaining}s</span>
                ) : complete ? (
                  <CheckIcon className="h-5 w-5 shrink-0 text-volt" />
                ) : (
                  <span className="flex shrink-0 items-center gap-1.5 text-muted">
                    <ClockIcon className="h-4 w-4" />
                    <span className="num text-sm font-semibold">
                      {done[i]}/{item.holds}
                    </span>
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
