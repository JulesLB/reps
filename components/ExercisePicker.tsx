"use client";

import { useMemo, useState } from "react";
import type { AppData, MuscleGroup } from "@/lib/types";
import { update, uid } from "@/lib/store";
import { CATALOG, searchCatalog } from "@/lib/catalog";
import { PlusIcon, SearchIcon, XIcon } from "./icons";

const MUSCLES: MuscleGroup[] = [
  "chest", "back", "shoulders", "biceps", "triceps",
  "quads", "hamstrings", "glutes", "calves", "core", "cardio", "other",
];

interface ExercisePickerProps {
  data: AppData;
  title: string;
  onPick: (exerciseId: string) => void;
  onClose: () => void;
}

export default function ExercisePicker({ data, title, onPick, onClose }: ExercisePickerProps) {
  const [q, setQ] = useState("");
  const [customMuscle, setCustomMuscle] = useState<MuscleGroup | null>(null);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    const mine = Object.values(data.exercises)
      .filter((e) => !query || e.name.toLowerCase().includes(query) || e.muscle.includes(query))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 12);
    const mineNames = new Set(Object.values(data.exercises).map((e) => e.name.toLowerCase()));
    const catalog = searchCatalog(q, 40).filter((c) => !mineNames.has(c.name.toLowerCase()));
    return { mine, catalog };
  }, [data, q]);

  const pickExisting = (id: string) => {
    onPick(id);
    onClose();
  };

  const pickCatalog = (name: string, muscle: MuscleGroup) => {
    const existing = Object.values(data.exercises).find(
      (e) => e.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) return pickExisting(existing.id);
    const id = uid();
    update((d) => {
      d.exercises[id] = { id, name, muscle };
    });
    onPick(id);
    onClose();
  };

  const createCustom = (muscle: MuscleGroup) => {
    const name = q.trim();
    if (!name) return;
    pickCatalog(name, muscle);
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-bg">
      <div
        className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col px-4"
        style={{ paddingTop: "max(env(safe-area-inset-top), 16px)" }}
      >
        <header className="mb-3 flex items-center justify-between">
          <h2 className="display text-2xl font-bold uppercase tracking-wide">{title}</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-faint transition-colors duration-150 hover:text-ink"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </header>

        <div className="relative mb-3">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            autoFocus
            aria-label="Search exercises"
            placeholder="Search machine or exercise…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setCustomMuscle(null);
            }}
            className="h-12 w-full rounded-2xl border border-line bg-surface-2 pl-10 pr-4 text-base outline-none placeholder:text-faint focus:border-volt/50"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pb-8">
          {results.mine.length > 0 && (
            <>
              <p className="display mb-1.5 mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">
                Your exercises
              </p>
              <div className="space-y-1">
                {results.mine.map((e) => (
                  <Row key={e.id} name={e.name} muscle={e.muscle} onClick={() => pickExisting(e.id)} />
                ))}
              </div>
            </>
          )}

          <p className="display mb-1.5 mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">
            Exercise library
          </p>
          <div className="space-y-1">
            {results.catalog.map((c) => (
              <Row key={c.name} name={c.name} muscle={c.muscle} onClick={() => pickCatalog(c.name, c.muscle)} />
            ))}
          </div>

          {q.trim().length > 1 && (
            <div className="mt-4 rounded-2xl border border-dashed border-line p-3">
              {customMuscle === null ? (
                <button
                  type="button"
                  onClick={() => setCustomMuscle("other")}
                  className="flex w-full items-center gap-2 text-left text-sm font-semibold text-volt"
                >
                  <PlusIcon className="h-4 w-4" strokeWidth={2.6} />
                  Create &ldquo;{q.trim()}&rdquo;
                </button>
              ) : (
                <div>
                  <p className="mb-2 text-sm font-semibold">
                    Which muscle does &ldquo;{q.trim()}&rdquo; work?
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {MUSCLES.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => createCustom(m)}
                        className="h-9 rounded-full border border-line bg-surface-2 px-3 text-sm capitalize text-muted transition-colors duration-150 hover:border-volt/50 hover:text-ink"
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ name, muscle, onClick }: { name: string; muscle: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-line-soft bg-surface px-3.5 py-2 text-left transition-colors duration-150 hover:border-volt/40"
    >
      <span className="text-sm font-medium">{name}</span>
      <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
        {muscle}
      </span>
    </button>
  );
}

export const CATALOG_SIZE = CATALOG.length;
