"use client";

import { useState } from "react";
import type { ActivityType } from "@/lib/types";
import { addActivity } from "@/lib/coach";
import { XIcon } from "./icons";

const TYPES: Array<{ key: ActivityType; label: string }> = [
  { key: "hike", label: "Hike" },
  { key: "walk", label: "Walk" },
  { key: "run", label: "Run" },
];

function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Bottom sheet for logging a hike/walk/run, matching the NewDaySheet pattern. */
export default function HikeSheet({ onClose }: { onClose: () => void }) {
  const [type, setType] = useState<ActivityType>("hike");
  const [date, setDate] = useState(today());
  const [minutes, setMinutes] = useState("");
  const [distance, setDistance] = useState("");
  const [elevation, setElevation] = useState("");

  const mins = Number(minutes);
  const valid = date && Number.isFinite(mins) && mins > 0;

  const submit = () => {
    if (!valid) return;
    addActivity({
      type,
      date,
      minutes: Math.round(mins),
      ...(Number(distance) > 0 ? { distanceKm: Number(distance) } : {}),
      ...(Number(elevation) > 0 ? { elevationM: Math.round(Number(elevation)) } : {}),
    });
    onClose();
  };

  const field =
    "h-12 w-full rounded-2xl border border-line bg-surface-2 px-3.5 text-base outline-none placeholder:text-faint focus:border-volt/50";

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-bg/80" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl border border-line-soft bg-surface p-5 pb-10"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-4 flex items-center justify-between">
          <h2 className="display text-xl font-bold uppercase tracking-wide">Log a hike</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-faint hover:text-ink"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </header>

        <div className="flex gap-2">
          {TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              aria-pressed={type === t.key}
              onClick={() => setType(t.key)}
              className={`h-11 flex-1 rounded-xl border text-sm font-semibold transition-colors duration-150 ${
                type === t.key
                  ? "border-volt/50 bg-volt/10 text-volt"
                  : "border-line bg-surface-2 text-muted"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-3 space-y-2">
          <input
            type="date"
            aria-label="Date"
            value={date}
            max={today()}
            onChange={(e) => setDate(e.target.value)}
            className={field}
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              type="number"
              inputMode="numeric"
              aria-label="Minutes"
              placeholder="min"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              className={field}
            />
            <input
              type="number"
              inputMode="decimal"
              aria-label="Distance in km"
              placeholder="km"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              className={field}
            />
            <input
              type="number"
              inputMode="numeric"
              aria-label="Elevation gain in metres"
              placeholder="m ↑"
              value={elevation}
              onChange={(e) => setElevation(e.target.value)}
              className={field}
            />
          </div>
        </div>

        <button
          type="button"
          disabled={!valid}
          onClick={submit}
          className="mt-4 h-13 w-full rounded-2xl bg-volt py-3.5 font-bold uppercase tracking-wide text-volt-ink transition-transform duration-150 active:scale-[0.98] disabled:opacity-40"
        >
          Save
        </button>
      </div>
    </div>
  );
}
