"use client";

import { useEffect, useMemo, useState } from "react";
import { uid, update, useAppData } from "@/lib/store";
import {
  buildSession,
  entryVisible,
  finishedSessions,
  formatDuration,
  formatElapsed,
  formatSeconds,
  extraDays,
  formatWeight,
  logTarget,
  personalRecords,
  planWeek,
  prefillCardio,
  prefillSets,
  restFor,
  rotationDays,
  sessionCardioMinutes,
  sessionSetCounts,
  sessionVolume,
  suggestNextDay,
} from "@/lib/logic";
import type { AppData, DayStyle, DayTemplate, Session } from "@/lib/types";
import ExerciseCard from "@/components/ExerciseCard";
import CardioCard from "@/components/CardioCard";
import EditDaySheet from "@/components/EditDaySheet";
import ExercisePicker from "@/components/ExercisePicker";
import { DayIcon } from "@/components/DayIcons";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  FlameIcon,
  PencilIcon,
  PlusIcon,
  TrophyIcon,
  XIcon,
} from "@/components/icons";

export default function TrainPage() {
  const data = useAppData();
  const [editDay, setEditDay] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [summary, setSummary] = useState<Session | null>(null);

  if (!data) return <PageSkeleton />;

  if (summary) {
    return <SessionSummary data={data} session={summary} onClose={() => setSummary(null)} />;
  }

  if (data.active) {
    return (
      <>
        <ActiveSession data={data} onFinished={setSummary} />
        {editDay && (
          <EditDaySheet
            key={editDay}
            data={data}
            dayId={editDay}
            onClose={() => setEditDay(null)}
            onSwitchDay={setEditDay}
          />
        )}
      </>
    );
  }

  return (
    <>
      <TrainHome data={data} onEdit={setEditDay} onCreate={() => setCreating(true)} />
      {editDay && (
        <EditDaySheet
          key={editDay}
          data={data}
          dayId={editDay}
          onClose={() => setEditDay(null)}
          onSwitchDay={setEditDay}
        />
      )}
      {creating && (
        <NewDaySheet
          onCreate={(id) => {
            setCreating(false);
            setEditDay(id);
          }}
          onClose={() => setCreating(false)}
        />
      )}
    </>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-4 pt-2">
      <div className="h-8 w-24 animate-pulse rounded-lg bg-surface" />
      <div className="h-48 animate-pulse rounded-3xl bg-surface" />
      <div className="h-24 animate-pulse rounded-3xl bg-surface" />
    </div>
  );
}

function startSession(data: AppData, day: DayTemplate) {
  update((d) => {
    d.active = buildSession(d, day, Date.now());
  });
}

function TrainHome({
  data,
  onEdit,
  onCreate,
}: {
  data: AppData;
  onEdit: (id: string) => void;
  onCreate: () => void;
}) {
  const suggestion = suggestNextDay(data);
  const cycle = rotationDays(data);
  const others = extraDays(data);
  const sessions = finishedSessions(data);
  const streak = weekSessionCount(data);
  const trainedToday =
    sessions[0] && new Date(sessions[0].startedAt).toDateString() === new Date().toDateString();

  const lastDone = (dayId: string): string | null => {
    const s = sessions.find((x) => x.dayId === dayId);
    if (!s) return null;
    const days = Math.floor((Date.now() - s.startedAt) / 86400000);
    if (days === 0) return "today";
    if (days === 1) return "yesterday";
    return `${days}d ago`;
  };

  const hero = suggestion?.day ?? null;

  const moveInCycle = (index: number, dir: -1 | 1) => {
    update((d) => {
      const j = index + dir;
      if (j < 0 || j >= d.rotation.length) return;
      [d.rotation[index], d.rotation[j]] = [d.rotation[j], d.rotation[index]];
    });
  };

  return (
    <div className="pt-2">
      <header className="mb-5 flex items-end justify-between">
        <h1 className="display text-3xl font-bold uppercase tracking-wide">
          Reps<span className="text-volt">.</span>
        </h1>
        <div className="flex items-center gap-1.5 text-muted">
          <FlameIcon className="h-4 w-4 text-amber" />
          <span className="num text-sm font-semibold">{streak} this week</span>
        </div>
      </header>

      {hero ? (
        <section className="rise rounded-3xl border border-volt/25 bg-gradient-to-b from-surface-2 to-surface p-5">
          <p className="display text-xs font-semibold uppercase tracking-[0.18em] text-volt">
            {trainedToday ? "Up next" : "Today"}
          </p>
          <div className="mt-1 flex items-start justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-volt/12 text-volt">
                <DayIcon dayName={hero.name} className="h-7 w-7" />
              </span>
              <h2 className="display min-w-0 text-4xl font-bold uppercase leading-none tracking-wide">
                {hero.name}
              </h2>
            </div>
            <button
              type="button"
              aria-label={`Edit ${hero.name} day`}
              onClick={() => onEdit(hero.id)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-faint transition-colors duration-150 hover:text-ink"
            >
              <PencilIcon className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-sm text-muted">
            {visibleCount(data, hero)} exercises
            {lastDone(hero.id) ? ` · last ${lastDone(hero.id)}` : ""}
          </p>
          <button
            type="button"
            onClick={() => startSession(data, hero)}
            className="mt-4 h-14 w-full rounded-2xl bg-volt text-lg font-bold uppercase tracking-wide text-volt-ink transition-transform duration-150 active:scale-[0.98]"
          >
            Start {hero.name}
          </button>
        </section>
      ) : (
        <section className="rise rounded-3xl border border-line-soft bg-surface p-5">
          <h2 className="display text-3xl font-bold uppercase leading-none tracking-wide text-muted">
            No sessions yet
          </h2>
          <p className="mt-2 text-sm text-faint">Create a session type to start your cycle.</p>
        </section>
      )}

      <section className="mt-5">
        <h2 className="display mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">
          Your cycle
        </h2>
        <div className="space-y-1.5">
          {cycle.map(({ day, index }) => {
            const isNext = index === suggestion?.index;
            return (
              <div
                key={`${day.id}-${index}`}
                className={`flex items-center gap-2 rounded-2xl border p-2.5 ${
                  isNext ? "border-volt/40 bg-volt/8" : "border-line-soft bg-surface"
                }`}
              >
                <span
                  className={`num display flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                    isNext ? "bg-volt text-volt-ink" : "bg-surface-2 text-faint"
                  }`}
                >
                  {index + 1}
                </span>
                <span className={`shrink-0 ${isNext ? "text-volt" : "text-muted"}`}>
                  <DayIcon dayName={day.name} className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="display truncate text-lg font-semibold uppercase leading-tight tracking-wide">
                    {day.name}
                  </h3>
                  <p className="truncate text-[11px] text-muted">
                    {visibleCount(data, day)} exercises
                    {lastDone(day.id) ? ` · last ${lastDone(day.id)}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col">
                  <button
                    type="button"
                    aria-label={`Move ${day.name} earlier in the cycle`}
                    onClick={() => moveInCycle(index, -1)}
                    disabled={index === 0}
                    className="flex h-5 w-7 items-center justify-center text-faint transition-colors duration-150 hover:text-ink disabled:opacity-25"
                  >
                    <ChevronUpIcon className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${day.name} later in the cycle`}
                    onClick={() => moveInCycle(index, 1)}
                    disabled={index === cycle.length - 1}
                    className="flex h-5 w-7 items-center justify-center text-faint transition-colors duration-150 hover:text-ink disabled:opacity-25"
                  >
                    <ChevronDownIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
                <button
                  type="button"
                  aria-label={`Edit ${day.name}`}
                  onClick={() => onEdit(day.id)}
                  className="flex h-10 w-8 shrink-0 items-center justify-center rounded-lg text-faint transition-colors duration-150 hover:text-ink"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => startSession(data, day)}
                  className={`h-10 shrink-0 rounded-xl px-3 text-sm font-semibold transition-colors duration-150 ${
                    isNext
                      ? "bg-volt text-volt-ink"
                      : "border border-line bg-surface-2 text-ink hover:border-volt/40"
                  }`}
                >
                  Start
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {others.length > 0 && (
        <section className="mt-5">
          <h2 className="display mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">
            Outside the cycle
          </h2>
          <div className="space-y-1.5">
            {others.map((day) => (
              <div key={day.id} className="flex items-center gap-2 rounded-2xl border border-line-soft bg-surface p-2.5">
                <span className="shrink-0 pl-1 text-muted">
                  <DayIcon dayName={day.name} className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="display truncate text-lg font-semibold uppercase leading-tight tracking-wide">
                    {day.name}
                  </h3>
                  <p className="truncate text-[11px] text-muted">
                    {visibleCount(data, day)} exercises
                    {lastDone(day.id) ? ` · last ${lastDone(day.id)}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Add ${day.name} to the cycle`}
                  onClick={() => update((d) => { d.rotation.push(day.id); })}
                  className="flex h-10 w-8 shrink-0 items-center justify-center rounded-lg text-faint transition-colors duration-150 hover:text-volt"
                >
                  <PlusIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label={`Edit ${day.name}`}
                  onClick={() => onEdit(day.id)}
                  className="flex h-10 w-8 shrink-0 items-center justify-center rounded-lg text-faint transition-colors duration-150 hover:text-ink"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => startSession(data, day)}
                  className="h-10 shrink-0 rounded-xl border border-line bg-surface-2 px-3 text-sm font-semibold text-ink transition-colors duration-150 hover:border-volt/40"
                >
                  Start
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={onCreate}
        className="mt-3 flex h-13 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line py-3.5 font-semibold text-muted transition-colors duration-150 hover:border-volt/40 hover:text-ink"
      >
        <PlusIcon className="h-4 w-4" /> New session type
      </button>
    </div>
  );
}

function visibleCount(data: AppData, day: DayTemplate): number {
  const week = planWeek(data);
  return day.entries.filter((e) => entryVisible(e, week)).length;
}

function weekSessionCount(data: AppData): number {
  const now = new Date();
  const day = (now.getDay() + 6) % 7;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day).getTime();
  return finishedSessions(data).filter((s) => s.startedAt >= start).length;
}

function NewDaySheet({ onCreate, onClose }: { onCreate: (id: string) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [style, setStyle] = useState<DayStyle>("strength");

  const create = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = uid();
    update((d) => {
      d.days.push({ id, name: trimmed, style, entries: [], exerciseIds: [] });
    });
    onCreate(id);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-bg/80" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl border border-line-soft bg-surface p-5 pb-10"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-4 flex items-center justify-between">
          <h2 className="display text-xl font-bold uppercase tracking-wide">New session type</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-faint hover:text-ink"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </header>
        <input
          autoFocus
          aria-label="Session type name"
          placeholder="Cardio, Arms, Core…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
          className="h-12 w-full rounded-2xl border border-line bg-surface-2 px-4 text-base outline-none placeholder:text-faint focus:border-volt/50"
        />
        <div className="mt-3 flex gap-2">
          {(["strength", "cardio"] as DayStyle[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStyle(s)}
              className={`h-11 flex-1 rounded-xl border text-sm font-semibold capitalize transition-colors duration-150 ${
                style === s
                  ? "border-volt/50 bg-volt/10 text-volt"
                  : "border-line bg-surface-2 text-muted"
              }`}
            >
              {s === "strength" ? "Strength · sets × reps" : "Cardio · minutes"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={create}
          disabled={!name.trim()}
          className="mt-4 h-13 w-full rounded-2xl bg-volt py-3.5 font-bold uppercase tracking-wide text-volt-ink transition-transform duration-150 active:scale-[0.98] disabled:opacity-40"
        >
          Create and add exercises
        </button>
      </div>
    </div>
  );
}

interface RestState {
  endsAt: number;
  total: number;
}

function ActiveSession({ data, onFinished }: { data: AppData; onFinished: (s: Session) => void }) {
  const session = data.active!;
  const { done, total } = sessionSetCounts(session);
  const [, tick] = useState(0);
  const [picker, setPicker] = useState<"add" | number | null>(null);
  const [rest, setRest] = useState<RestState | null>(null);

  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Buzz and clear when the rest countdown runs out.
  useEffect(() => {
    if (!rest) return;
    const ms = rest.endsAt - Date.now();
    if (ms <= 0) {
      setRest(null);
      return;
    }
    const t = setTimeout(() => {
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([180, 90, 180]);
      setRest(null);
    }, ms);
    return () => clearTimeout(t);
  }, [rest]);

  const startRest = (exerciseId: string) => {
    const seconds = restFor(data, exerciseId);
    setRest({ endsAt: Date.now() + seconds * 1000, total: seconds });
  };

  const elapsed = formatElapsed(Date.now() - session.startedAt);
  const pct = total ? done / total : 0;

  const handlePick = (exerciseId: string) => {
    if (picker === null) return;
    if (picker === "add") {
      update((d) => {
        if (!d.active) return;
        if (d.active.logs.some((l) => l.exerciseId === exerciseId)) return;
        if (d.active.style === "cardio") {
          d.active.logs.push({ exerciseId, sets: [], cardio: prefillCardio(d, exerciseId) });
        } else {
          d.active.logs.push({
            exerciseId,
            sets: prefillSets(d, exerciseId, undefined, d.active.dayId),
          });
        }
      });
    } else {
      const index = picker;
      const oldLog = session.logs[index];
      const oldId = oldLog?.exerciseId;
      update((d) => {
        if (!d.active || !d.active.logs[index]) return;
        const prev = d.active.logs[index];
        if (prev.cardio) {
          d.active.logs[index] = { exerciseId, sets: [], cardio: prefillCardio(d, exerciseId) };
        } else {
          const target = logTarget(d, prev);
          d.active.logs[index] = {
            exerciseId,
            sets: prefillSets(d, exerciseId, target, d.active.dayId),
            targetSets: prev.targetSets,
            targetReps: prev.targetReps,
          };
        }
      });
      const dayName = session.dayName;
      if (
        oldId &&
        oldId !== exerciseId &&
        confirm(`Also replace it in the ${dayName} template for future sessions?`)
      ) {
        update((d) => {
          const day = d.days.find((x) => x.id === session.dayId);
          if (!day) return;
          const entry = day.entries.find((e) => e.exerciseId === oldId);
          if (entry && !day.entries.some((e) => e.exerciseId === exerciseId)) {
            entry.exerciseId = exerciseId;
            day.exerciseIds = day.entries.map((e) => e.exerciseId);
          }
        });
      }
    }
  };

  const finish = () => {
    const finished: Session = { ...session, finishedAt: Date.now() };
    update((d) => {
      d.sessions.push(finished);
      d.active = null;
    });
    onFinished(finished);
  };

  const discard = () => {
    if (confirm("Discard this session? Nothing will be saved.")) {
      update((d) => {
        if (d.active) d.discardedActiveIds = [...d.discardedActiveIds, d.active.id].slice(-50);
        d.active = null;
      });
    }
  };

  const restRemaining = rest ? Math.max(0, Math.ceil((rest.endsAt - Date.now()) / 1000)) : 0;

  return (
    <div>
      <header
        className="sticky z-40 -mx-4 mb-3 border-b border-line-soft bg-bg/90 px-4 pb-3 backdrop-blur-lg"
        style={{ top: 0, paddingTop: "max(env(safe-area-inset-top), 12px)" }}
      >
        <div className="flex items-center gap-3">
          <ProgressRing pct={pct} />
          <div className="min-w-0 flex-1">
            <h1 className="display truncate text-2xl font-bold uppercase leading-none tracking-wide">
              {session.dayName}
            </h1>
            <p className="num mt-0.5 text-xs text-muted">
              {elapsed} · {done}/{total} sets
            </p>
          </div>
          <button
            type="button"
            aria-label="Discard session"
            onClick={discard}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-faint transition-colors duration-150 hover:text-warn"
          >
            <XIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={finish}
            className="flex h-11 items-center gap-1.5 rounded-xl bg-volt px-4 font-bold uppercase tracking-wide text-volt-ink transition-transform duration-150 active:scale-[0.97]"
          >
            <CheckIcon className="h-4 w-4" strokeWidth={2.8} /> Finish
          </button>
        </div>
      </header>

      <div className="space-y-3">
        {session.logs.map((log, i) =>
          log.cardio ? (
            <CardioCard
              key={log.exerciseId + i}
              data={data}
              log={log}
              onMutate={(fn) =>
                update((d) => {
                  const target = d.active?.logs[i];
                  if (target) fn(target);
                })
              }
              onDelete={() =>
                update((d) => {
                  if (d.active) d.active.logs.splice(i, 1);
                })
              }
            />
          ) : (
            <ExerciseCard
              key={log.exerciseId + i}
              data={data}
              log={log}
              dayId={session.dayId}
              onSetDone={startRest}
              onMutate={(fn) =>
                update((d) => {
                  const target = d.active?.logs[i];
                  if (target) fn(target);
                })
              }
              onSwap={() => setPicker(i)}
              onDelete={() =>
                update((d) => {
                  if (d.active) d.active.logs.splice(i, 1);
                })
              }
            />
          )
        )}
      </div>

      <button
        type="button"
        onClick={() => setPicker("add")}
        className="mt-3 flex h-13 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line py-3.5 font-semibold text-muted transition-colors duration-150 hover:border-volt/40 hover:text-ink"
      >
        <PlusIcon className="h-4 w-4" /> Add exercise
      </button>

      {rest && restRemaining > 0 && (
        <RestBar
          remaining={restRemaining}
          total={rest.total}
          onExtend={() => setRest((r) => (r ? { endsAt: r.endsAt + 30000, total: r.total + 30 } : r))}
          onDismiss={() => setRest(null)}
        />
      )}

      {picker !== null && (
        <ExercisePicker
          data={data}
          title={picker === "add" ? "Add exercise" : "Swap exercise"}
          onPick={handlePick}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}

function RestBar({
  remaining,
  total,
  onExtend,
  onDismiss,
}: {
  remaining: number;
  total: number;
  onExtend: () => void;
  onDismiss: () => void;
}) {
  const pct = total ? remaining / total : 0;
  return (
    <div
      className="fixed left-1/2 z-40 w-[calc(100%-32px)] max-w-[416px] -translate-x-1/2 rounded-2xl border border-volt/30 bg-surface-2 p-3 shadow-lg shadow-black/40"
      style={{ bottom: "calc(84px + env(safe-area-inset-bottom))" }}
      role="timer"
      aria-label={`Rest, ${remaining} seconds left`}
    >
      <div className="flex items-center gap-3">
        <span className="display text-xs font-semibold uppercase tracking-[0.16em] text-volt">
          Rest
        </span>
        <span className="num display text-2xl font-bold tabular-nums">{formatSeconds(remaining)}</span>
        <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-volt transition-[width] duration-1000 ease-linear"
            style={{ width: `${pct * 100}%` }}
          />
        </div>
        <button
          type="button"
          onClick={onExtend}
          className="num h-9 shrink-0 rounded-lg border border-line bg-surface px-2.5 text-xs font-semibold text-muted active:text-ink"
        >
          +30s
        </button>
        <button
          type="button"
          aria-label="Skip rest"
          onClick={onDismiss}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-faint active:text-ink"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden className="-rotate-90">
      <circle cx="22" cy="22" r={r} fill="none" stroke="var(--line)" strokeWidth="4" />
      <circle
        cx="22"
        cy="22"
        r={r}
        fill="none"
        stroke="var(--volt)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct)}
        style={{ transition: "stroke-dashoffset 300ms ease" }}
      />
    </svg>
  );
}

function SessionSummary({ data, session, onClose }: { data: AppData; session: Session; onClose: () => void }) {
  const { done } = sessionSetCounts(session);
  const volume = sessionVolume(session);
  const cardioMin = sessionCardioMinutes(session);
  const prs = useMemo(() => personalRecords(data, session), [data, session]);
  const duration = session.finishedAt ? formatDuration(session.finishedAt - session.startedAt) : "—";
  const [templateSaved, setTemplateSaved] = useState(false);

  const templateChanged = useMemo(() => {
    const day = data.days.find((d) => d.id === session.dayId);
    if (!day || templateSaved) return false;
    const week = planWeek(data);
    const visible = day.entries.filter((e) => entryVisible(e, week));
    const logIds = session.logs.map((l) => l.exerciseId);
    if (visible.length !== logIds.length) return true;
    if (!visible.every((e) => logIds.includes(e.exerciseId))) return true;
    return session.logs.some((l) => {
      if (l.cardio) return false;
      const entry = visible.find((e) => e.exerciseId === l.exerciseId);
      if (!entry) return true;
      const workSets = l.sets.filter((s) => !s.warmup).length;
      return workSets > 0 && workSets !== entry.sets;
    });
  }, [data, session, templateSaved]);

  const saveTemplate = () => {
    update((d) => {
      const day = d.days.find((x) => x.id === session.dayId);
      if (!day) return;
      // Gated rehab entries (fromWeek) survive even when they weren't in the
      // session, so a skipped week can't erase the comeback plan.
      const gated = day.entries.filter(
        (e) => e.fromWeek && !session.logs.some((l) => l.exerciseId === e.exerciseId)
      );
      day.entries = [
        ...session.logs.map((l) => {
          const old = day.entries.find((e) => e.exerciseId === l.exerciseId);
          const workSets = Math.max(1, l.sets.filter((s) => !s.warmup).length || 1);
          if (old) return { ...old, sets: l.cardio ? old.sets : workSets };
          return {
            exerciseId: l.exerciseId,
            sets: l.cardio ? 1 : workSets,
            reps: l.targetReps ?? d.settings.targetReps,
          };
        }),
        ...gated,
      ];
      day.exerciseIds = day.entries.map((e) => e.exerciseId);
    });
    setTemplateSaved(true);
  };

  return (
    <div className="rise pt-6">
      <p className="display text-xs font-semibold uppercase tracking-[0.18em] text-volt">
        Session saved
      </p>
      <h1 className="display mt-1 text-5xl font-bold uppercase tracking-wide">
        {session.dayName} done
      </h1>

      <div className="mt-6 grid grid-cols-3 gap-2">
        <Stat label="Duration" value={duration} />
        <Stat label={volume === 0 && cardioMin > 0 ? "Blocks" : "Sets"} value={String(done)} />
        {volume === 0 && cardioMin > 0 ? (
          <Stat label="Cardio" value={`${cardioMin} min`} />
        ) : (
          <Stat label="Volume" value={`${formatWeight(Math.round(volume))} kg`} />
        )}
      </div>

      {prs.length > 0 && (
        <div className="mt-4 rounded-2xl border border-amber/30 bg-amber/10 p-4">
          <p className="flex items-center gap-2 font-semibold text-amber">
            <TrophyIcon className="h-5 w-5" /> {prs.length} new top {prs.length === 1 ? "weight" : "weights"}
          </p>
          <ul className="mt-1 text-sm text-ink/90">
            {prs.map((id) => (
              <li key={id}>{data.exercises[id]?.name}</li>
            ))}
          </ul>
        </div>
      )}

      {templateChanged && (
        <div className="mt-4 rounded-2xl border border-volt/25 bg-volt/8 p-4">
          <p className="font-semibold">This session didn&apos;t match your {session.dayName} template.</p>
          <p className="mt-1 text-sm text-muted">
            Save what you actually did, so next {session.dayName} starts from it?
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={saveTemplate}
              className="h-11 flex-1 rounded-xl bg-volt px-4 text-sm font-bold uppercase tracking-wide text-volt-ink"
            >
              Update template
            </button>
            <button
              type="button"
              onClick={() => setTemplateSaved(true)}
              className="h-11 rounded-xl border border-line bg-surface-2 px-4 text-sm font-semibold text-muted"
            >
              Keep as is
            </button>
          </div>
        </div>
      )}
      {templateSaved && (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted">
          <CheckIcon className="h-4 w-4 text-volt" /> Template handled.
        </p>
      )}

      <button
        type="button"
        onClick={onClose}
        className="mt-6 h-14 w-full rounded-2xl bg-volt text-lg font-bold uppercase tracking-wide text-volt-ink transition-transform duration-150 active:scale-[0.98]"
      >
        Done
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line-soft bg-surface p-3 text-center">
      <p className="num display text-2xl font-bold">{value}</p>
      <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}
