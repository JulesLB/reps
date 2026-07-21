"use client";

import type { SetLog } from "@/lib/types";
import NumberField from "./NumberField";
import { CheckIcon, TriangleDownIcon, TriangleUpIcon } from "./icons";

interface SetRowProps {
  index: number;
  set: SetLog;
  /** Same-position set from the last session, for the "beat last time" cue. */
  prev?: SetLog;
  increment: number;
  onChange: (s: SetLog) => void;
}

export default function SetRow({ index, set, prev, increment, onChange }: SetRowProps) {
  const toggle = () => {
    if (!set.done && typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(18);
    onChange({ ...set, done: !set.done });
  };

  // Live vs. last time's same-position set: heavier = up, lighter = down, equal =
  // nothing. Shown as you dial the weight, before the set is even ticked, so it's
  // a direction cue not a verdict. Weight only — matches how the lift is judged.
  const trend =
    !set.warmup && prev
      ? set.weight > prev.weight
        ? "up"
        : set.weight < prev.weight
          ? "down"
          : null
      : null;

  return (
    <div
      className={`flex items-center gap-2 rounded-2xl px-1 py-1.5 transition-colors duration-200 ${
        set.done ? "bg-volt/8" : ""
      }`}
    >
      <div className="w-7 shrink-0 text-center">
        <span
          className={`display text-sm font-semibold ${
            set.warmup ? "text-amber" : set.done ? "text-volt" : "text-faint"
          }`}
        >
          {set.warmup ? "W" : index}
        </span>
      </div>
      <div className="relative flex min-w-0 flex-1">
        <NumberField
          label={`Set ${index} weight`}
          value={set.weight}
          step={increment}
          onChange={(weight) => onChange({ ...set, weight })}
          dimmed={set.done}
        />
        {trend && (
          <span
            className={`pointer-events-none absolute -bottom-1 right-0 ${
              trend === "up" ? "text-volt" : "text-faint"
            }`}
          >
            {trend === "up" ? (
              <TriangleUpIcon className="h-2.5 w-2.5" />
            ) : (
              <TriangleDownIcon className="h-2.5 w-2.5" />
            )}
          </span>
        )}
      </div>
      <NumberField
        label={`Set ${index} reps`}
        value={set.reps}
        step={1}
        onChange={(reps) => onChange({ ...set, reps })}
        dimmed={set.done}
      />
      <button
        type="button"
        aria-label={set.done ? `Mark set ${index} not done` : `Mark set ${index} done`}
        onClick={toggle}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all duration-200 ${
          set.done
            ? "pop border-volt bg-volt text-volt-ink"
            : "border-volt/30 bg-volt/12 text-volt/60 hover:bg-volt/20 hover:text-volt"
        }`}
      >
        <CheckIcon className="h-5 w-5" strokeWidth={2.6} />
      </button>
    </div>
  );
}
