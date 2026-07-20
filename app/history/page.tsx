"use client";

import { useState } from "react";
import { useAppData } from "@/lib/store";
import {
  finishedSessions,
  formatDuration,
  formatWeight,
  sessionCardioMinutes,
  sessionMuscles,
  sessionSetCounts,
  sessionVolume,
} from "@/lib/logic";
import type { AppData, Session } from "@/lib/types";
import { ChevronDownIcon, ChevronUpIcon, SettingsIcon, XIcon } from "@/components/icons";
import { DayIcon } from "@/components/DayIcons";
import SyncPanel from "@/components/SyncPanel";

export default function HistoryPage() {
  const data = useAppData();
  const [open, setOpen] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  if (!data) return <div className="h-48 animate-pulse rounded-3xl bg-surface" />;

  const sessions = finishedSessions(data);

  return (
    <div className="pt-2">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="display text-3xl font-bold uppercase tracking-wide">History</h1>
        <button
          type="button"
          aria-label="Settings"
          onClick={() => setShowSettings(true)}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-faint transition-colors duration-150 hover:text-ink"
        >
          <SettingsIcon className="h-5 w-5" />
        </button>
      </header>

      {sessions.length === 0 && (
        <p className="mt-12 text-center text-muted">No sessions yet. Go lift something.</p>
      )}

      <div className="space-y-2">
        {sessions.map((session) => (
          <SessionCard
            key={session.id}
            data={data}
            session={session}
            open={open === session.id}
            onToggle={() => setOpen(open === session.id ? null : session.id)}
          />
        ))}
      </div>

      {showSettings && <SettingsSheet data={data} onClose={() => setShowSettings(false)} />}
    </div>
  );
}

function SessionCard({
  data,
  session,
  open,
  onToggle,
}: {
  data: AppData;
  session: Session;
  open: boolean;
  onToggle: () => void;
}) {
  const { done } = sessionSetCounts(session);
  const volume = sessionVolume(session);
  const cardioMin = sessionCardioMinutes(session);
  const muscles = sessionMuscles(data, session);
  const d = new Date(session.startedAt);
  const dateLabel = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const duration = session.finishedAt ? formatDuration(session.finishedAt - session.startedAt) : "—";
  const detail =
    volume === 0 && cardioMin > 0
      ? `${cardioMin} min cardio`
      : `${done} sets · ${formatWeight(Math.round(volume))} kg`;

  return (
    <div className="overflow-hidden rounded-2xl border border-line-soft bg-surface">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 p-4 text-left">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-volt">
          <DayIcon dayName={session.dayName} className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="display font-semibold uppercase tracking-wide">
            {session.dayName}
          </p>
          <p className="num text-xs text-muted">
            {dateLabel} · {duration} · {detail}
          </p>
        </div>
        {open ? (
          <ChevronUpIcon className="h-4 w-4 shrink-0 text-faint" />
        ) : (
          <ChevronDownIcon className="h-4 w-4 shrink-0 text-faint" />
        )}
      </button>
      {open && (
        <div className="border-t border-line-soft px-4 py-3">
          {muscles.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {muscles.map((m) => (
                <span
                  key={m.muscle}
                  className="flex items-center gap-1 rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[11px] font-medium capitalize text-muted"
                >
                  {m.muscle}
                  <span className="num font-bold text-ink">{m.sets}</span>
                </span>
              ))}
            </div>
          )}
          {/* Name and sets stack, so a long machine name plus a warm-up can
              never push one exercise past two lines. */}
          <ul className="space-y-2">
            {session.logs.map((log) => {
              const ex = data.exercises[log.exerciseId];
              const name = ex?.name ?? "Deleted exercise";
              if (log.cardio?.done) {
                return (
                  <li key={log.exerciseId}>
                    <p className="truncate text-sm">{name}</p>
                    <p className="num mt-0.5 text-xs text-muted">
                      {log.cardio.minutes} min · L{log.cardio.level}
                    </p>
                  </li>
                );
              }
              const sets = log.sets.filter((s) => s.done);
              if (!sets.length) return null;
              return (
                <li key={log.exerciseId}>
                  <p className="truncate text-sm">{name}</p>
                  <p className="num mt-0.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-xs">
                    {sets.map((s, i) => (
                      <span key={i} className={s.warmup ? "text-amber/70" : "text-muted"}>
                        {formatWeight(s.weight)}×{s.reps}
                      </span>
                    ))}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function SettingsSheet({ data, onClose }: { data: AppData; onClose: () => void }) {
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reps-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Restores an exported file onto this device. Replaces everything, so it
  // doubles as "move my history to a new phone".
  const importJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as AppData;
        if (!parsed || typeof parsed !== "object" || !parsed.exercises || !Array.isArray(parsed.sessions)) {
          alert("That file doesn't look like a REPS export.");
          return;
        }
        const incoming = parsed.sessions.length;
        const current = data.sessions.length;
        if (!confirm(`Replace this device's data (${current} sessions) with the file (${incoming} sessions)?`)) return;
        localStorage.setItem("gym-tracker-v1", JSON.stringify(parsed));
        location.reload();
      } catch {
        alert("Couldn't read that file.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-bg/80" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl border border-line-soft bg-surface p-5 pb-10"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-4 flex items-center justify-between">
          <h2 className="display text-xl font-bold uppercase tracking-wide">Settings</h2>
          <button
            type="button"
            aria-label="Close settings"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-faint hover:text-ink"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </header>
        <div className="space-y-2">
          <SyncPanel />
          <button
            type="button"
            onClick={exportJson}
            className="h-12 w-full rounded-xl border border-line bg-surface-2 px-4 text-left text-sm font-semibold transition-colors duration-150 hover:border-volt/40"
          >
            Export all data (JSON)
          </button>
          <label className="flex h-12 w-full cursor-pointer items-center rounded-xl border border-line bg-surface-2 px-4 text-sm font-semibold transition-colors duration-150 hover:border-volt/40">
            Restore from a backup file
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importJson(file);
                e.target.value = "";
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              if (confirm("Delete ALL data, including your sessions and exercises? This cannot be undone.")) {
                localStorage.removeItem("gym-tracker-v1");
                location.reload();
              }
            }}
            className="h-12 w-full rounded-xl border border-warn/30 px-4 text-left text-sm font-semibold text-warn transition-colors duration-150 hover:bg-warn/10"
          >
            Reset everything
          </button>
        </div>
      </div>
    </div>
  );
}
