"use client";

import { useState } from "react";
import { update, useAppData } from "@/lib/store";
import { formatPace, runHistory, weekStart, weeklyRunKm } from "@/lib/logic";
import type { AppData, ProgramPhase } from "@/lib/types";
import StorageWarning from "@/components/StorageWarning";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, FlagIcon } from "@/components/icons";

const DAY = 24 * 3600 * 1000;

function parseISO(date: string): number {
  return new Date(`${date}T12:00:00`).getTime();
}

function shortDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function PlanPage() {
  const data = useAppData();
  if (!data) return <div className="h-48 animate-pulse rounded-3xl bg-surface" />;

  const program = data.program;
  const hasProgram = program.phases.length > 0 || program.events.length > 0;

  return (
    <div className="pt-2">
      <header className="mb-4">
        <h1 className="display text-3xl font-bold uppercase tracking-wide">Plan</h1>
      </header>

      <StorageWarning />

      {hasProgram ? (
        <>
          {program.name && (
            <p className="display mb-3 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-info">
              {program.name}
            </p>
          )}
          <Events data={data} />
          <Phases data={data} />
          {program.notes && program.notes.length > 0 && (
            <section className="mt-5">
              <h2 className="display mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">
                Standing rules
              </h2>
              <ul className="space-y-1.5 rounded-2xl border border-line-soft bg-surface p-4 text-sm text-muted">
                {program.notes.map((n, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-faint">·</span>
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      ) : (
        <section className="rounded-3xl border border-line-soft bg-surface p-5">
          <FlagIcon className="h-6 w-6 text-faint" />
          <h2 className="display mt-2 text-2xl font-bold uppercase tracking-wide text-muted">
            No program loaded
          </h2>
          <p className="mt-1 text-sm text-faint">
            A program is a long-arc plan: the races you&apos;re training for and the phases on the
            way. The coach loads one from the laptop; it will show up here on the next sync.
          </p>
        </section>
      )}

      <Running data={data} />
    </div>
  );
}

function Events({ data }: { data: AppData }) {
  const today = Date.now();
  const events = [...data.program.events].sort((a, b) => (a.date < b.date ? -1 : 1));
  if (!events.length) return null;
  return (
    <div className="space-y-2">
      {events.map((e) => {
        const days = Math.ceil((parseISO(e.date) - today) / DAY);
        const past = days < 0;
        return (
          <section
            key={e.id}
            className={`flex items-center justify-between rounded-3xl border p-4 ${
              past ? "border-line-soft bg-surface opacity-60" : "border-info/25 bg-gradient-to-b from-surface-2 to-surface"
            }`}
          >
            <div className="min-w-0">
              <h2 className="display truncate text-xl font-bold uppercase tracking-wide">{e.name}</h2>
              <p className="text-xs text-muted">{shortDate(e.date)}</p>
            </div>
            <div className="shrink-0 text-right">
              {past ? (
                <p className="display text-sm font-semibold uppercase text-muted">done</p>
              ) : (
                <>
                  <p className="num display text-3xl font-bold leading-none text-info">{days}</p>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted">days to go</p>
                </>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function phaseWindow(phases: ProgramPhase[], i: number): string {
  const from = shortDate(phases[i].from);
  const next = phases[i + 1];
  return next ? `${from} → ${shortDate(next.from)}` : `from ${from}`;
}

/** Index of the phase running today: the last one whose start is not in the future. */
function currentPhaseIndex(phases: ProgramPhase[], now: number): number {
  let current = -1;
  phases.forEach((p, i) => {
    if (parseISO(p.from) <= now) current = i;
  });
  return current;
}

/**
 * 1-based week within a phase, counted in calendar weeks (Monday start) so the
 * phase's own instructions ("from week 3", "week 4 is a down week") have a
 * number in the app to anchor to.
 */
function phaseWeek(phase: ProgramPhase, now: number): number {
  const WEEK = 7 * 24 * 3600 * 1000;
  return Math.max(1, Math.floor((weekStart(now) - weekStart(parseISO(phase.from))) / WEEK) + 1);
}

function Phases({ data }: { data: AppData }) {
  const [open, setOpen] = useState<string | null>(null);
  const phases = data.program.phases;
  if (!phases.length) return null;
  const now = Date.now();
  const currentIdx = currentPhaseIndex(phases, now);

  const applyCycle = (phase: ProgramPhase) => {
    if (!phase.rotation?.length) return;
    if (!confirm(`Load the ${phase.name} cycle into your Hyrox plan? Your gym plan and its cycle are not touched.`)) return;
    update((d) => {
      d.hyroxRotation = phase.rotation!.map((s) => ({ ...s }));
      d.activeTrack = "hyrox";
    });
  };

  return (
    <section className="mt-5">
      <h2 className="display mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">
        Phases
      </h2>
      <p className="mb-2 px-1 text-[11px] text-faint">
        A phase&apos;s cycle loads into the Hyrox plan on the Train tab. Your gym plan keeps its
        own cycle.
      </p>
      <div className="space-y-1.5">
        {phases.map((phase, i) => {
          const isCurrent = i === currentIdx;
          const isPast = i < currentIdx;
          const isOpen = open === phase.id;
          const cycleActive =
            !!phase.rotation?.length &&
            JSON.stringify(phase.rotation) === JSON.stringify(data.hyroxRotation);
          return (
            <div
              key={phase.id}
              className={`rounded-2xl border ${
                isCurrent ? "border-info/40 bg-info/5" : "border-line-soft bg-surface"
              } ${isPast ? "opacity-70" : ""}`}
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : phase.id)}
                className="flex w-full items-center gap-2.5 p-3 text-left"
              >
                <span
                  className={`num display flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                    isCurrent ? "bg-info text-volt-ink" : "bg-surface-2 text-faint"
                  }`}
                >
                  {isPast ? <CheckIcon className="h-4 w-4" strokeWidth={2.6} /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="display truncate text-lg font-semibold uppercase leading-tight tracking-wide">
                      {phase.name}
                    </span>
                    {isCurrent && (
                      <span className="shrink-0 rounded-full border border-info/40 bg-info/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-info">
                        now · wk {phaseWeek(phase, now)}
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-[11px] text-muted">
                    {phaseWindow(phases, i)} · {phase.focus}
                  </span>
                </span>
                <span className="shrink-0 text-faint">
                  {isOpen ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
                </span>
              </button>
              {isOpen && (
                <div className="border-t border-line-soft px-3 pb-3 pt-2.5">
                  {phase.week.length > 0 && (
                    <ul className="space-y-1 text-sm text-muted">
                      {phase.week.map((line, j) => (
                        <li key={j} className="flex gap-2">
                          <span className="text-faint">·</span>
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {phase.rotation && phase.rotation.length > 0 && (
                    cycleActive ? (
                      <p className="mt-3 flex items-center gap-2 text-sm text-muted">
                        <CheckIcon className="h-4 w-4 text-info" strokeWidth={2.6} /> This is your
                        Hyrox cycle.
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => applyCycle(phase)}
                        className="mt-3 h-11 w-full rounded-xl border border-info/50 bg-info/10 text-sm font-bold uppercase tracking-wide text-info transition-transform duration-150 active:scale-[0.98]"
                      >
                        Use this phase&apos;s cycle
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Running({ data }: { data: AppData }) {
  const runs = runHistory(data);
  const weeks = weeklyRunKm(data, 6);
  const maxKm = Math.max(...weeks.map((w) => w.km), 1);
  const recent = [...runs].reverse().slice(0, 6);
  // A time trial is just a logged run near 5 km; the best recent pace is the benchmark.
  const tts = runs.filter((r) => r.km >= 4.5 && r.km <= 5.5);
  const bestTT = tts.length ? tts.reduce((a, b) => (b.pace < a.pace ? b : a)) : null;

  return (
    <section className="mt-5">
      <h2 className="display mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">
        Running
      </h2>
      <div className="rounded-2xl border border-line-soft bg-surface p-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="num display text-2xl font-bold">
              {weeks[weeks.length - 1].km.toFixed(1).replace(/\.0$/, "")} km
            </p>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted">this week</p>
          </div>
          {bestTT && (
            <div className="text-right">
              <p className="num display text-2xl font-bold text-info">{formatPace(bestTT.pace)}</p>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
                best 5k pace /km
              </p>
            </div>
          )}
        </div>
        <div className="mt-3 flex h-16 items-end gap-1.5">
          {weeks.map((w) => (
            <div key={w.weekStart} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-info/60"
                style={{ height: `${Math.max(4, (w.km / maxKm) * 100)}%` }}
              />
              <span className="num text-[9px] text-faint">
                {w.km ? w.km.toFixed(0) : "·"}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-1 text-center text-[10px] uppercase tracking-wide text-faint">
          km per week · last 6
        </p>

        {recent.length > 0 ? (
          <ul className="mt-3 space-y-1 border-t border-line-soft pt-3">
            {recent.map((r, i) => (
              <li key={`${r.t}-${i}`} className="num flex items-center justify-between text-sm">
                <span className="text-muted">
                  {new Date(r.t).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </span>
                <span>
                  {r.km.toFixed(1).replace(/\.0$/, "")} km · {r.minutes} min ·{" "}
                  <span className="text-info">{formatPace(r.pace)} /km</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 border-t border-line-soft pt-3 text-sm text-faint">
            No runs with a distance yet. Log km on any run block, or log an outdoor run from the
            Train tab, and the trend builds itself.
          </p>
        )}
      </div>
    </section>
  );
}
