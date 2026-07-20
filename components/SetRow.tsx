"use client";

import type { SetLog } from "@/lib/types";
import NumberField from "./NumberField";
import { CheckIcon } from "./icons";
import { formatWeight } from "@/lib/logic";

interface SetRowProps {
  index: number;
  set: SetLog;
  prev: string | null;
  increment: number;
  onChange: (s: SetLog) => void;
}

export default function SetRow({ index, set, prev, increment, onChange }: SetRowProps) {
  const toggle = () => {
    if (!set.done && typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(18);
    onChange({ ...set, done: !set.done });
  };

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
        {prev && (
          <div className="num text-[10px] leading-tight text-faint">{prev}</div>
        )}
      </div>
      <NumberField
        label={`Set ${index} weight`}
        value={set.weight}
        step={increment}
        onChange={(weight) => onChange({ ...set, weight })}
        dimmed={set.done}
      />
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

export function prevLabel(weight: number, reps: number): string {
  return `${formatWeight(weight)}×${reps}`;
}
