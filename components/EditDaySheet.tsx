"use client";

import { useState } from "react";
import type { AppData, MuscleGroup, Track } from "@/lib/types";
import { uid, update } from "@/lib/store";
import { entryIsCardio, planWeek } from "@/lib/logic";
import ExercisePicker from "./ExercisePicker";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, CopyIcon, MinusIcon, PlusIcon, TrashIcon, XIcon } from "./icons";

const MUSCLES: MuscleGroup[] = [
  "chest", "back", "shoulders", "biceps", "triceps",
  "quads", "hamstrings", "glutes", "calves", "core", "cardio", "other",
];

interface EditDaySheetProps {
  data: AppData;
  dayId: string;
  onClose: () => void;
  /** Switch the editor to another day (used after duplicating). */
  onSwitchDay?: (id: string) => void;
}

export default function EditDaySheet({ data, dayId, onClose, onSwitchDay }: EditDaySheetProps) {
  const day = data.days.find((d) => d.id === dayId);
  const [showPicker, setShowPicker] = useState(false);
  if (!day) return null;

  const week = planWeek(data);

  const mutateDay = (fn: (t: NonNullable<typeof day>) => void) => {
    update((d) => {
      const t = d.days.find((x) => x.id === dayId);
      if (!t) return;
      fn(t);
      t.exerciseIds = t.entries.map((e) => e.exerciseId);
    });
  };

  const move = (i: number, dir: -1 | 1) => {
    mutateDay((t) => {
      const j = i + dir;
      if (j < 0 || j >= t.entries.length) return;
      [t.entries[i], t.entries[j]] = [t.entries[j], t.entries[i]];
    });
  };

  const duplicate = () => {
    const id = uid();
    update((d) => {
      const src = d.days.find((x) => x.id === dayId);
      if (!src) return;
      d.days.push({
        id,
        name: `${src.name} copy`,
        style: src.style,
        ...(src.track ? { track: src.track } : {}),
        entries: src.entries.map((e) => ({ ...e })),
        exerciseIds: [...src.exerciseIds],
      });
    });
    // Lands outside the cycle; the user adds it to the rotation from the home screen.
    onSwitchDay?.(id);
  };

  const deleteDay = () => {
    if (data.days.length <= 1) return;
    if (!confirm(`Delete the ${day.name} session type? Past sessions stay in your history.`)) return;
    update((d) => {
      d.days = d.days.filter((x) => x.id !== dayId);
      // Dropping steps can orphan a `withPrev` on what follows; re-normalize.
      // The day may sit in either plan's cycle, so both are cleaned.
      const without = (rot: typeof d.rotation) => {
        const kept = (rot ?? []).filter((s) => s.dayId !== dayId);
        if (kept[0]?.withPrev) delete kept[0].withPrev;
        return kept;
      };
      d.rotation = without(d.rotation);
      d.hyroxRotation = without(d.hyroxRotation);
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-bg">
      <div className="mx-auto max-w-md px-4 pb-16" style={{ paddingTop: "max(env(safe-area-inset-top), 16px)" }}>
        <header className="mb-4 flex items-center justify-between gap-3">
          <input
            aria-label="Session type name"
            defaultValue={day.name}
            onBlur={(e) => {
              const name = e.target.value.trim();
              if (name && name !== day.name) mutateDay((t) => { t.name = name; });
            }}
            className="display min-w-0 flex-1 rounded-lg bg-transparent px-1 py-1 text-2xl font-bold uppercase tracking-wide outline-none focus:bg-surface-2"
          />
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-volt px-4 font-semibold text-volt-ink transition-colors duration-150"
          >
            <CheckIcon className="h-4 w-4" strokeWidth={2.6} /> Done
          </button>
        </header>

        <div className="mb-4 flex gap-2">
          {(["gym", "hyrox"] as Track[]).map((t) => {
            const active = (day.track ?? "gym") === t;
            return (
              <button
                key={t}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  mutateDay((x) => {
                    if (t === "hyrox") x.track = "hyrox";
                    else delete x.track;
                  })
                }
                className={`h-10 flex-1 rounded-xl border text-sm font-semibold transition-colors duration-150 ${
                  active
                    ? t === "hyrox"
                      ? "border-info/50 bg-info/10 text-info"
                      : "border-volt/50 bg-volt/10 text-volt"
                    : "border-line bg-surface-2 text-muted"
                }`}
              >
                {t === "gym" ? "Gym track" : "Hyrox track"}
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          {day.entries.map((entry, i) => {
            const ex = data.exercises[entry.exerciseId];
            if (!ex) return null;
            const gatedOut = entry.fromWeek && week < entry.fromWeek;
            return (
              <div key={entry.exerciseId + i} className={`rounded-2xl border border-line-soft bg-surface p-2 ${gatedOut ? "opacity-60" : ""}`}>
                <div className="flex items-center gap-2">
                  <div className="flex flex-col">
                    <button
                      type="button"
                      aria-label={`Move ${ex.name} up`}
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      className="flex h-6 w-8 items-center justify-center text-faint transition-colors duration-150 hover:text-ink disabled:opacity-30"
                    >
                      <ChevronUpIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${ex.name} down`}
                      onClick={() => move(i, 1)}
                      disabled={i === day.entries.length - 1}
                      className="flex h-6 w-8 items-center justify-center text-faint transition-colors duration-150 hover:text-ink disabled:opacity-30"
                    >
                      <ChevronDownIcon className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="min-w-0 flex-1">
                    <input
                      aria-label="Exercise name"
                      defaultValue={ex.name}
                      onBlur={(e) => {
                        const name = e.target.value.trim();
                        if (name && name !== ex.name) update((d) => { d.exercises[entry.exerciseId].name = name; });
                      }}
                      className="w-full rounded-lg bg-transparent px-1 py-1 font-semibold outline-none focus:bg-surface-2"
                    />
                    <div className="flex items-center gap-2">
                      <select
                        aria-label="Muscle group"
                        value={ex.muscle}
                        onChange={(e) => update((d) => { d.exercises[entry.exerciseId].muscle = e.target.value as MuscleGroup; })}
                        className="rounded-lg bg-transparent px-1 py-0.5 text-xs uppercase tracking-wide text-muted outline-none"
                      >
                        {MUSCLES.map((m) => (
                          <option key={m} value={m} className="bg-surface text-ink">{m}</option>
                        ))}
                      </select>
                      {gatedOut && (
                        <span className="rounded-full border border-amber/40 px-2 py-0.5 text-[10px] font-medium text-amber">
                          from week {entry.fromWeek}
                        </span>
                      )}
                    </div>
                    {entry.note && <p className="px-1 text-[11px] text-amber/80">{entry.note}</p>}
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${ex.name}`}
                    onClick={() => mutateDay((t) => { t.entries.splice(i, 1); })}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-faint transition-colors duration-150 hover:text-warn"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                </div>
                {entryIsCardio(data, day, entry.exerciseId) ? (
                  <div className="mt-1 pl-10">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <TargetStepper
                        label="Sets"
                        value={entry.sets}
                        min={1}
                        onChange={(v) => mutateDay((t) => { t.entries[i].sets = v; })}
                      />
                      {entry.sets >= 2 && (
                        <TargetStepper
                          label="m / set"
                          value={entry.reps}
                          min={50}
                          step={50}
                          onChange={(v) => mutateDay((t) => { t.entries[i].reps = v; })}
                        />
                      )}
                    </div>
                    <p className="mt-1 text-[10px] text-faint">
                      1 set logs minutes + km · 2+ sets logs intervals with the rest timer
                    </p>
                  </div>
                ) : (
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 pl-10">
                    <TargetStepper
                      label="Sets"
                      value={entry.sets}
                      min={1}
                      onChange={(v) => mutateDay((t) => { t.entries[i].sets = v; })}
                    />
                    <TargetStepper
                      label="Reps"
                      value={entry.reps}
                      min={1}
                      onChange={(v) => mutateDay((t) => { t.entries[i].reps = v; })}
                    />
                    {entry.distanceM != null ? (
                      <TargetStepper
                        label="m"
                        value={entry.distanceM}
                        min={0}
                        step={5}
                        onChange={(v) =>
                          mutateDay((t) => {
                            if (v > 0) t.entries[i].distanceM = v;
                            else delete t.entries[i].distanceM;
                          })
                        }
                      />
                    ) : (
                      <button
                        type="button"
                        aria-label={`Add a distance per set to ${ex.name}`}
                        onClick={() => mutateDay((t) => { t.entries[i].distanceM = 20; })}
                        className="h-8 rounded-lg border border-dashed border-line px-2 text-[11px] font-semibold text-faint transition-colors duration-150 hover:text-ink"
                      >
                        + m
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line py-3.5 font-semibold text-muted transition-colors duration-150 hover:border-volt/40 hover:text-ink"
        >
          <PlusIcon className="h-4 w-4" /> Add exercise
        </button>

        <button
          type="button"
          onClick={duplicate}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-line py-3.5 text-sm font-semibold text-muted transition-colors duration-150 hover:border-volt/40 hover:text-ink"
        >
          <CopyIcon className="h-4 w-4" /> Duplicate this session type
        </button>

        {data.days.length > 1 && (
          <button
            type="button"
            onClick={deleteDay}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-warn/30 py-3.5 text-sm font-semibold text-warn transition-colors duration-150 hover:bg-warn/10"
          >
            <TrashIcon className="h-4 w-4" /> Delete this session type
          </button>
        )}
      </div>

      {showPicker && (
        <ExercisePicker
          data={data}
          title={`Add to ${day.name}`}
          onPick={(exerciseId) =>
            mutateDay((t) => {
              if (!t.entries.some((e) => e.exerciseId === exerciseId)) {
                t.entries.push({
                  exerciseId,
                  sets: data.settings.targetSets,
                  reps: data.settings.targetReps,
                });
              }
            })
          }
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}

function TargetStepper({
  label,
  value,
  min,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="display text-[10px] font-semibold uppercase tracking-wide text-faint">{label}</span>
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        onClick={() => onChange(Math.max(min, value - step))}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface-2 text-muted active:bg-line"
      >
        <MinusIcon className="h-3.5 w-3.5" />
      </button>
      <span className={`num display text-center text-sm font-bold ${step > 1 ? "w-9" : "w-6"}`}>{value}</span>
      <button
        type="button"
        aria-label={`Increase ${label}`}
        onClick={() => onChange(value + step)}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface-2 text-muted active:bg-line"
      >
        <PlusIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
