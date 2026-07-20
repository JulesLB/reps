"use client";

import type { AppData, ExerciseLog } from "@/lib/types";
import NumberField from "./NumberField";
import { CheckIcon, TrashIcon } from "./icons";

interface CardioCardProps {
  data: AppData;
  log: ExerciseLog;
  onMutate: (fn: (log: ExerciseLog) => void) => void;
  onDelete?: () => void;
}

export default function CardioCard({ data, log, onMutate, onDelete }: CardioCardProps) {
  const exercise = data.exercises[log.exerciseId];
  const cardio = log.cardio;
  if (!exercise || !cardio) return null;

  const toggle = () => {
    if (!cardio.done && typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(18);
    onMutate((l) => {
      if (l.cardio) l.cardio.done = !l.cardio.done;
    });
  };

  return (
    <section className="rise rounded-3xl border border-line-soft bg-surface p-3">
      <header className="mb-2 flex items-start justify-between gap-2 px-1">
        <div className="min-w-0">
          <h3 className="display text-xl font-semibold leading-tight">{exercise.name}</h3>
          {log.note && <p className="mt-0.5 text-xs text-amber/90">{log.note}</p>}
        </div>
        {onDelete && (
          <button
            type="button"
            aria-label={`Remove ${exercise.name} from this session`}
            onClick={() => {
              if (cardio.done && !confirm(`Remove ${exercise.name}?`)) return;
              onDelete();
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-faint transition-colors duration-150 hover:text-warn"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        )}
      </header>

      <div className="flex items-center gap-2 px-1">
        <div className="min-w-0 flex-1">
          <p className="display mb-0.5 text-center text-[9px] font-semibold uppercase tracking-wide text-faint">
            Minutes
          </p>
          <NumberField
            label={`${exercise.name} minutes`}
            value={cardio.minutes}
            step={5}
            onChange={(minutes) => onMutate((l) => { if (l.cardio) l.cardio.minutes = minutes; })}
            dimmed={cardio.done}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="display mb-0.5 text-center text-[9px] font-semibold uppercase tracking-wide text-faint">
            Level
          </p>
          <NumberField
            label={`${exercise.name} level`}
            value={cardio.level}
            step={1}
            onChange={(level) => onMutate((l) => { if (l.cardio) l.cardio.level = level; })}
            dimmed={cardio.done}
          />
        </div>
        <div className="shrink-0 pt-4">
          <button
            type="button"
            aria-label={cardio.done ? "Mark not done" : "Mark done"}
            onClick={toggle}
            className={`flex h-11 w-11 items-center justify-center rounded-xl border transition-all duration-200 ${
              cardio.done
                ? "pop border-volt bg-volt text-volt-ink"
                : "border-volt/30 bg-volt/12 text-volt/60 hover:bg-volt/20 hover:text-volt"
            }`}
          >
            <CheckIcon className="h-5 w-5" strokeWidth={2.6} />
          </button>
        </div>
      </div>
    </section>
  );
}
