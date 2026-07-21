"use client";

import { useState } from "react";
import type { AppData, ExerciseLog, SetLog } from "@/lib/types";
import {
  exerciseHistory,
  formatWeight,
  logTarget,
  overloadSuggestion,
  restFor,
  formatSeconds,
  type ExerciseHistoryEntry,
} from "@/lib/logic";
import { update } from "@/lib/store";
import SetRow from "./SetRow";
import { ArrowUpIcon, ChevronDownIcon, ChevronUpIcon, ClockIcon, MinusIcon, PlusIcon, SwapIcon, TrashIcon } from "./icons";

const MUSCLE_LABEL: Record<string, string> = {
  chest: "Chest", back: "Back", shoulders: "Shoulders", biceps: "Biceps",
  triceps: "Triceps", quads: "Quads", hamstrings: "Hams", glutes: "Glutes",
  calves: "Calves", core: "Core", cardio: "Cardio", other: "Other",
};

const REST_PRESETS = [60, 90, 120, 150, 180];

interface ExerciseCardProps {
  data: AppData;
  log: ExerciseLog;
  dayId?: string;
  onMutate: (fn: (log: ExerciseLog) => void) => void;
  onSetDone?: (exerciseId: string) => void;
  onSwap?: () => void;
  onDelete?: () => void;
}

export default function ExerciseCard({ data, log, dayId, onMutate, onSetDone, onSwap, onDelete }: ExerciseCardProps) {
  const exercise = data.exercises[log.exerciseId];
  if (!exercise) return null;

  const target = logTarget(data, log);
  const history = exerciseHistory(data, log.exerciseId, dayId, 3);
  const overload = overloadSuggestion(data, log.exerciseId, target, dayId);
  const doneCount = log.sets.filter((s) => s.done && !s.warmup).length;
  const workCount = log.sets.filter((s) => !s.warmup).length;
  const hasWarmup = log.sets.some((s) => s.warmup);
  const rest = restFor(data, log.exerciseId);
  // Last session's working sets, positionally aligned, so a set can flag when it
  // beats what was lifted there before.
  const lastSets = history[0]?.sets;

  // All edits apply to the live stored log, never a stale copy, so quick
  // successive taps on different sets can't overwrite each other.
  const setSet = (i: number, s: SetLog) => {
    const startedRest = s.done && !log.sets[i]?.done && !s.warmup;
    onMutate((l) => {
      if (l.sets[i]) l.sets[i] = s;
    });
    if (startedRest) onSetDone?.(log.exerciseId);
  };

  const cycleRest = () => {
    const next = REST_PRESETS[(REST_PRESETS.indexOf(rest) + 1) % REST_PRESETS.length] ?? 90;
    update((d) => {
      const ex = d.exercises[log.exerciseId];
      if (ex) ex.rest = next;
    });
  };

  const addSet = (warmup: boolean) => {
    onMutate((l) => {
      const work = l.sets.filter((s) => !s.warmup);
      const template = warmup ? l.sets[0] ?? work[0] : work[work.length - 1] ?? l.sets[0];
      const weight = template
        ? warmup
          ? Math.max(0, Math.round(template.weight / 2 / 2.5) * 2.5)
          : template.weight
        : 20;
      const next: SetLog = {
        weight,
        reps: warmup ? 12 : target.reps,
        done: false,
        ...(warmup ? { warmup: true } : {}),
      };
      if (warmup) l.sets.unshift(next);
      else l.sets.push(next);
    });
  };

  // Only ever drops a work set, so the warm-up can't trap the last row,
  // and never empties the exercise down to nothing.
  const removeLastSet = () => {
    onMutate((l) => {
      const work = l.sets.filter((s) => !s.warmup);
      if (work.length <= 1) return;
      for (let i = l.sets.length - 1; i >= 0; i--) {
        if (!l.sets[i].warmup) {
          l.sets.splice(i, 1);
          return;
        }
      }
    });
  };

  const removeWarmups = () => {
    onMutate((l) => {
      for (let i = l.sets.length - 1; i >= 0; i--) {
        if (l.sets[i].warmup) l.sets.splice(i, 1);
      }
    });
  };

  let workIndex = 0;

  return (
    <section className="rise rounded-3xl border border-line-soft bg-surface p-2">
      <header className="mb-2 flex items-start justify-between gap-2 px-1">
        <div className="min-w-0">
          <h3 className="display text-xl font-semibold leading-tight">{exercise.name}</h3>
          {log.note && <p className="mt-0.5 text-xs text-amber/90">{log.note}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full border border-line px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted">
              {MUSCLE_LABEL[exercise.muscle]}
            </span>
            <button
              type="button"
              aria-label={`Rest ${formatSeconds(rest)}, tap to change`}
              onClick={cycleRest}
              className="num flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[11px] font-medium text-muted transition-colors duration-150 active:border-volt/40 active:text-ink"
            >
              <ClockIcon className="h-3 w-3" /> {formatSeconds(rest)}
            </button>
            {overload && (
              <span className="flex items-center gap-1 rounded-full border border-volt/40 bg-volt/10 px-2 py-0.5 text-[11px] font-semibold text-volt">
                <ArrowUpIcon className="h-3 w-3" strokeWidth={2.6} />
                Load {overload.to} — cleared {target.sets}×{target.reps} @ {overload.from}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="num display text-sm font-semibold text-faint">
            {doneCount}/{workCount}
          </span>
          {onSwap && (
            <button
              type="button"
              aria-label={`Swap ${exercise.name} for another exercise`}
              onClick={onSwap}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-faint transition-colors duration-150 hover:text-ink"
            >
              <SwapIcon className="h-4 w-4" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              aria-label={`Remove ${exercise.name} from this session`}
              onClick={() => {
                if (doneCount > 0 && !confirm(`Remove ${exercise.name}? ${doneCount} logged ${doneCount === 1 ? "set" : "sets"} will be lost.`)) return;
                onDelete();
              }}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-faint transition-colors duration-150 hover:text-warn"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      {history.length > 0 && <LastTime history={history} />}

      <div className="mb-0.5 flex items-center gap-2 px-1" aria-hidden>
        <div className="w-7 shrink-0 text-center leading-tight">
          <span className="display block text-[9px] font-semibold uppercase tracking-wide text-faint">Set</span>
        </div>
        <span className="display min-w-0 flex-1 text-center text-[9px] font-semibold uppercase tracking-wide text-faint">
          Weight kg
        </span>
        <span className="display min-w-0 flex-1 text-center text-[9px] font-semibold uppercase tracking-wide text-faint">
          Reps
        </span>
        <span className="display w-10 shrink-0 text-center text-[9px] font-semibold uppercase tracking-wide text-faint">
          Done
        </span>
      </div>

      <div className="space-y-1">
        {log.sets.map((set, i) => {
          const idx = set.warmup ? 0 : ++workIndex;
          return (
            <SetRow
              key={i}
              index={idx}
              set={set}
              prev={set.warmup ? undefined : lastSets?.[idx - 1]}
              increment={data.settings.increment}
              onChange={(s) => setSet(i, s)}
            />
          );
        })}
      </div>

      <footer className="mt-2 flex items-center gap-2 px-1">
        <button
          type="button"
          onClick={() => addSet(false)}
          className="flex h-10 items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-3 text-sm font-semibold text-muted transition-colors duration-150 hover:text-ink"
        >
          <PlusIcon className="h-4 w-4" /> Set
        </button>
        {hasWarmup ? (
          <button
            type="button"
            onClick={removeWarmups}
            aria-label="Remove warm-up set"
            className="flex h-10 items-center gap-1.5 rounded-xl border border-amber/40 bg-amber/10 px-3 text-sm font-semibold text-amber transition-colors duration-150 active:bg-amber/20"
          >
            <MinusIcon className="h-4 w-4" /> Warm-up
          </button>
        ) : (
          <button
            type="button"
            onClick={() => addSet(true)}
            aria-label="Add warm-up set"
            className="flex h-10 items-center gap-1.5 rounded-xl border border-dashed border-amber/40 px-3 text-sm font-semibold text-amber/80 transition-colors duration-150 hover:text-amber"
          >
            <PlusIcon className="h-4 w-4" /> Warm-up
          </button>
        )}
        {/* Only an undo for sets added beyond the plan, so the normal footer stays two buttons. */}
        {workCount > target.sets && workCount > 1 && (
          <button
            type="button"
            onClick={removeLastSet}
            aria-label="Remove last set"
            className="ml-auto flex h-10 items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-3 text-sm font-semibold text-muted transition-colors duration-150 hover:text-ink"
          >
            <MinusIcon className="h-4 w-4" /> Set
          </button>
        )}
      </footer>
    </section>
  );
}

const shortDate = (t: number) =>
  new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const setsLabel = (e: ExerciseHistoryEntry) =>
  e.sets.map((s) => `${formatWeight(s.weight)}×${s.reps}`).join("  ");

/**
 * One dim, tappable line under the exercise: last session's working sets at a
 * glance, expanding to the last few sessions on tap. Kept deliberately quiet so
 * it never competes with the live inputs.
 */
function LastTime({ history }: { history: ExerciseHistoryEntry[] }) {
  const [open, setOpen] = useState(false);
  const canExpand = history.length > 1;

  return (
    <button
      type="button"
      onClick={() => canExpand && setOpen((o) => !o)}
      aria-label="Last time"
      className={`mb-1.5 flex w-full items-center gap-1.5 rounded-lg px-1 py-0.5 text-left text-[11px] text-faint ${
        canExpand ? "transition-colors duration-150 active:text-muted" : ""
      }`}
    >
      <span className="display shrink-0 font-semibold uppercase tracking-wide text-faint/70">Last</span>
      {open ? (
        <span className="num flex min-w-0 flex-1 flex-col gap-0.5">
          {history.map((e, i) => (
            <span key={i} className="truncate">
              <span className="text-faint/60">{shortDate(e.startedAt)}</span>  {setsLabel(e)}
            </span>
          ))}
        </span>
      ) : (
        <span className="num min-w-0 flex-1 truncate">
          {setsLabel(history[0])}
          <span className="text-faint/60">  ·  {shortDate(history[0].startedAt)}</span>
        </span>
      )}
      {canExpand &&
        (open ? (
          <ChevronUpIcon className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronDownIcon className="h-3 w-3 shrink-0" />
        ))}
    </button>
  );
}
