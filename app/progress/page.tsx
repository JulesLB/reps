"use client";

import { useMemo, useState } from "react";
import { useAppData } from "@/lib/store";
import {
  finishedSessions,
  formatDuration,
  formatWeight,
  muscleSetsForRange,
  periodRange,
  PERIODS,
  rangeStats,
  topSetSeries,
} from "@/lib/logic";
import type { PeriodKey, Range } from "@/lib/logic";
import type { AppData } from "@/lib/types";
import { TopSetChart, MuscleVolumeBars } from "@/components/charts";
import { DayIcon } from "@/components/DayIcons";
import { ArrowUpIcon, SearchIcon, XIcon } from "@/components/icons";

export default function ProgressPage() {
  const data = useAppData();
  if (!data) return <div className="h-48 animate-pulse rounded-3xl bg-surface" />;
  if (finishedSessions(data).length === 0) {
    return (
      <div className="pt-2">
        <h1 className="display text-3xl font-bold uppercase tracking-wide">Progress</h1>
        <p className="mt-12 text-center text-muted">Finish a session and your charts appear here.</p>
      </div>
    );
  }
  return <ProgressView data={data} />;
}

function ProgressView({ data }: { data: AppData }) {
  const [period, setPeriod] = useState<PeriodKey>("week");
  const range = useMemo(() => periodRange(data, period), [data, period]);
  const stats = useMemo(() => rangeStats(data, range.from, range.to), [data, range]);

  return (
    <div className="pt-2">
      <h1 className="display mb-3 text-3xl font-bold uppercase tracking-wide">Progress</h1>

      <div className="mb-4 flex gap-1.5">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            aria-pressed={period === p.key}
            onClick={() => setPeriod(p.key)}
            className={`h-9 flex-1 rounded-xl border text-xs font-semibold transition-colors duration-150 ${
              period === p.key
                ? "border-volt/50 bg-volt/12 text-volt"
                : "border-line bg-surface-2 text-muted"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <section className="rounded-3xl border border-line-soft bg-surface p-4">
        <h2 className="display mb-3 text-lg font-semibold uppercase tracking-wide">{range.label}</h2>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-volt/25 bg-volt/8 p-3 text-center">
            <p className="num display text-3xl font-bold leading-none text-volt">{stats.total.count}</p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted">
              {stats.total.count === 1 ? "Session" : "Sessions"}
            </p>
          </div>
          <div className="rounded-2xl border border-volt/25 bg-volt/8 p-3 text-center">
            <p className="num display text-3xl font-bold leading-none text-volt">
              {stats.total.count ? formatDuration(stats.total.durationMs) : "0 min"}
            </p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted">Time</p>
          </div>
        </div>

        <div className="mt-3 space-y-1">
          {stats.types.map((t) => (
            <div
              key={t.dayId}
              className={`flex items-center gap-3 rounded-xl px-2 py-1.5 ${t.count > 0 ? "bg-surface-2" : ""}`}
            >
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center ${t.count > 0 ? "text-volt" : "text-faint"}`}>
                <DayIcon dayName={t.dayName} className="h-5 w-5" />
              </span>
              <span className={`min-w-0 flex-1 truncate text-sm ${t.count > 0 ? "text-ink" : "text-faint"}`}>
                {t.dayName}
              </span>
              <span className="num shrink-0 text-xs text-muted">
                {t.count ? formatDuration(t.durationMs) : "—"}
              </span>
              <span className={`num display w-5 shrink-0 text-right text-sm font-bold ${t.count > 0 ? "text-ink" : "text-faint"}`}>
                {t.count}
              </span>
            </div>
          ))}
        </div>
      </section>

      <StrengthSection data={data} />

      <WeeklyVolumeSection data={data} range={range} />
    </div>
  );
}

function StrengthSection({ data }: { data: AppData }) {
  const exercisesWithData = useMemo(() => {
    return Object.values(data.exercises)
      .map((e) => ({ ...e, series: topSetSeries(data, e.id) }))
      .filter((e) => e.series.length > 0)
      .sort((a, b) => b.series[b.series.length - 1].t - a.series[a.series.length - 1].t);
  }, [data]);

  const [selected, setSelected] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);

  const current = exercisesWithData.find((e) => e.id === selected) ?? exercisesWithData[0];

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return exercisesWithData;
    return exercisesWithData.filter(
      (e) => e.name.toLowerCase().includes(query) || e.muscle.includes(query)
    );
  }, [exercisesWithData, q]);

  const delta = useMemo(() => {
    if (!current || current.series.length < 2) return null;
    const s = current.series;
    const cutoff = s[s.length - 1].t - 30 * 86400000;
    const past = s.filter((p) => p.t <= cutoff);
    const base = past.length ? past[past.length - 1] : s[0];
    return s[s.length - 1].w - base.w;
  }, [current]);

  if (!current) return null;

  return (
    <section className="mt-4 rounded-3xl border border-line-soft bg-surface p-4">
      <header className="mb-3 flex items-baseline justify-between">
        <h2 className="display text-lg font-semibold uppercase tracking-wide">Strength</h2>
        {delta !== null && (
          <span className={`flex items-center gap-1 text-sm font-semibold ${delta > 0 ? "text-volt" : "text-muted"}`}>
            {delta > 0 && <ArrowUpIcon className="h-3.5 w-3.5" strokeWidth={2.6} />}
            <span className="num">{delta > 0 ? "+" : ""}{formatWeight(delta)} kg / 30d</span>
          </span>
        )}
      </header>

      {searching ? (
        <div className="mb-3">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              autoFocus
              aria-label="Search your exercises"
              placeholder="Search your exercises…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-12 w-full rounded-2xl border border-volt/40 bg-surface-2 pl-10 pr-11 text-base outline-none placeholder:text-faint"
            />
            <button
              type="button"
              aria-label="Close search"
              onClick={() => {
                setSearching(false);
                setQ("");
              }}
              className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-faint hover:text-ink"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
            {results.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => {
                  setSelected(e.id);
                  setSearching(false);
                  setQ("");
                }}
                className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-line-soft bg-surface-2 px-3.5 py-2 text-left transition-colors duration-150 hover:border-volt/40"
              >
                <span className="text-sm font-medium">{e.name}</span>
                <span className="num shrink-0 text-xs text-muted">
                  {formatWeight(e.series[e.series.length - 1].w)} kg
                </span>
              </button>
            ))}
            {results.length === 0 && (
              <p className="py-4 text-center text-sm text-faint">No logged exercise matches.</p>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setSearching(true)}
          className="mb-3 flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border border-line bg-surface-2 px-3.5 py-2 text-left transition-colors duration-150 hover:border-volt/40"
        >
          <span>
            <span className="block font-semibold">{current.name}</span>
            <span className="text-xs capitalize text-muted">{current.muscle}</span>
          </span>
          <SearchIcon className="h-4 w-4 shrink-0 text-faint" />
        </button>
      )}

      <TopSetChart points={current.series} unit="kg" />
    </section>
  );
}

function WeeklyVolumeSection({ data, range }: { data: AppData; range: Range }) {
  // Longer periods are averaged per week, so the 10-20 growth band stays the
  // yardstick instead of a three-month total dwarfing it.
  const counts = useMemo(() => {
    const totals = muscleSetsForRange(data, range.from, range.to);
    if (!range.averaged || range.weeks <= 1) return totals;
    const avg: Record<string, number> = {};
    for (const [m, n] of Object.entries(totals)) avg[m] = Math.round((n / range.weeks) * 10) / 10;
    return avg;
  }, [data, range]);

  const muscles = useMemo(() => {
    const used = new Set(Object.values(data.exercises).map((e) => e.muscle));
    const order = ["chest", "back", "shoulders", "biceps", "triceps", "quads", "hamstrings", "glutes", "calves", "core", "other"];
    return order.filter((m) => used.has(m as never));
  }, [data]);

  return (
    <section className="mt-4 rounded-3xl border border-line-soft bg-surface p-4">
      <header className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="display text-lg font-semibold uppercase tracking-wide">Volume</h2>
        <span className="text-[11px] text-faint">
          {range.averaged ? "avg sets / week" : "sets this week"}
        </span>
      </header>
      <MuscleVolumeBars counts={counts} muscles={muscles} />
    </section>
  );
}
