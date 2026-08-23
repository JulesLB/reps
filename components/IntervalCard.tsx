"use client";

import type { AppData, ExerciseLog, SetLog } from "@/lib/types";
import { formatSeconds, restFor } from "@/lib/logic";
import { update } from "@/lib/store";
import NumberField from "./NumberField";
import { CheckIcon, ClockIcon, MinusIcon, PlusIcon, TrashIcon } from "./icons";

const REST_PRESETS = [45, 60, 90, 120, 180];

interface IntervalCardProps {
  data: AppData;
  log: ExerciseLog;
  onMutate: (fn: (log: ExerciseLog) => void) => void;
  onSetDone?: (exerciseId: string) => void;
  onDelete?: () => void;
}

/**
 * Erg intervals (row, ski): a fixed number of efforts with meters per effort,
 * ticked off one by one with the same rest countdown as a strength exercise,
 * so the app paces the whole 5×500 m instead of leaving it to a phone timer.
 */
export default function IntervalCard({ data, log, onMutate, onSetDone, onDelete }: IntervalCardProps) {
  const exercise = data.exercises[log.exerciseId];
  if (!exercise) return null;

  const doneCount = log.sets.filter((s) => s.done).length;
  const rest = restFor(data, log.exerciseId);

  const cycleRest = () => {
    const next = REST_PRESETS[(REST_PRESETS.indexOf(rest) + 1) % REST_PRESETS.length] ?? 90;
    update((d) => {
      const ex = d.exercises[log.exerciseId];
      if (ex) ex.rest = next;
    });
  };

  const setSet = (i: number, s: SetLog) => {
    const startedRest = s.done && !log.sets[i]?.done;
    if (startedRest && typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(18);
    onMutate((l) => {
      if (l.sets[i]) l.sets[i] = s;
    });
    if (startedRest) onSetDone?.(log.exerciseId);
  };

  const addSet = () => {
    onMutate((l) => {
      const last = l.sets[l.sets.length - 1];
      l.sets.push({ weight: 0, reps: last?.reps ?? 500, done: false });
    });
  };

  const removeLastSet = () => {
    const last = log.sets[log.sets.length - 1];
    if (last?.done && !confirm(`Remove the last interval? ${last.reps} m was logged.`)) return;
    onMutate((l) => {
      if (l.sets.length > 1) l.sets.pop();
    });
  };

  const totalMeters = log.sets.reduce((s, set) => (set.done ? s + set.reps : s), 0);

  return (
    <section className="rise rounded-3xl border border-line-soft bg-surface p-2">
      <header className="mb-2 flex items-start justify-between gap-2 px-1">
        <div className="min-w-0">
          <h3 className="display text-xl font-semibold leading-tight">{exercise.name}</h3>
          {log.note && <p className="mt-0.5 text-xs text-amber/90">{log.note}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full border border-line px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted">
              Intervals
            </span>
            {log.targetSets && log.targetReps && (
              <span className="num rounded-full border border-line px-2 py-0.5 text-[11px] font-medium text-muted">
                {log.targetSets} × {log.targetReps} m
              </span>
            )}
            <button
              type="button"
              aria-label={`Rest ${formatSeconds(rest)}, tap to change`}
              onClick={cycleRest}
              className="num flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[11px] font-medium text-muted transition-colors duration-150 active:border-volt/40 active:text-ink"
            >
              <ClockIcon className="h-3 w-3" /> {formatSeconds(rest)}
            </button>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="num display text-sm font-semibold text-faint">
            {doneCount}/{log.sets.length}
          </span>
          {onDelete && (
            <button
              type="button"
              aria-label={`Remove ${exercise.name} from this session`}
              onClick={() => {
                if (doneCount > 0 && !confirm(`Remove ${exercise.name}? ${doneCount} logged ${doneCount === 1 ? "interval" : "intervals"} will be lost.`)) return;
                onDelete();
              }}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-faint transition-colors duration-150 hover:text-warn"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      <div className="mb-0.5 flex items-center gap-2 px-1" aria-hidden>
        <div className="w-7 shrink-0 text-center leading-tight">
          <span className="display block text-[9px] font-semibold uppercase tracking-wide text-faint">Set</span>
        </div>
        <span className="display min-w-0 flex-1 text-center text-[9px] font-semibold uppercase tracking-wide text-faint">
          Meters
        </span>
        <span className="display w-11 shrink-0 text-center text-[9px] font-semibold uppercase tracking-wide text-faint">
          Done
        </span>
      </div>

      <div className="space-y-1">
        {log.sets.map((set, i) => (
          <div key={i} className="flex items-center gap-2 px-1">
            <span
              className={`num display flex h-11 w-7 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                set.done ? "text-volt" : "text-faint"
              }`}
            >
              {i + 1}
            </span>
            <NumberField
              label={`${exercise.name} interval ${i + 1} meters`}
              value={set.reps}
              step={50}
              onChange={(reps) => setSet(i, { ...set, reps })}
              dimmed={set.done}
            />
            <button
              type="button"
              aria-label={set.done ? `Mark interval ${i + 1} not done` : `Mark interval ${i + 1} done`}
              onClick={() => setSet(i, { ...set, done: !set.done })}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-all duration-200 ${
                set.done
                  ? "pop border-volt bg-volt text-volt-ink"
                  : "border-volt/30 bg-volt/12 text-volt/60 hover:bg-volt/20 hover:text-volt"
              }`}
            >
              <CheckIcon className="h-5 w-5" strokeWidth={2.6} />
            </button>
          </div>
        ))}
      </div>

      <footer className="mt-2 flex items-center gap-2 px-1">
        <button
          type="button"
          onClick={addSet}
          className="flex h-10 items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-3 text-sm font-semibold text-muted transition-colors duration-150 hover:text-ink"
        >
          <PlusIcon className="h-4 w-4" /> Interval
        </button>
        {log.sets.length > 1 && (
          <button
            type="button"
            onClick={removeLastSet}
            aria-label="Remove last interval"
            className="ml-auto flex h-10 items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-3 text-sm font-semibold text-muted transition-colors duration-150 hover:text-ink"
          >
            <MinusIcon className="h-4 w-4" /> Interval
          </button>
        )}
        {totalMeters > 0 && (
          <span className={`num text-xs text-muted ${log.sets.length > 1 ? "" : "ml-auto"}`}>
            {totalMeters} m total
          </span>
        )}
      </footer>
    </section>
  );
}
