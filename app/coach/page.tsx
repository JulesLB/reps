"use client";

import { useMemo, useState } from "react";
import { useAppData } from "@/lib/store";
import type { AppData, CoachRec, CoachReview, InBodyEntry } from "@/lib/types";
import {
  addConstraint,
  inbodySeries,
  latestReview,
  latestStepWeek,
  removeConstraint,
  setGoal,
} from "@/lib/coach";
import { TopSetChart } from "@/components/charts";
import {
  ArmsIcon,
  LegsIcon,
  PlusIcon,
  SparkIcon,
  TrashIcon,
  TriangleDownIcon,
  TriangleUpIcon,
  TrunkIcon,
} from "@/components/icons";

function fmtDate(iso: string | number): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function CoachPage() {
  const data = useAppData();
  if (!data) return <div className="h-48 animate-pulse rounded-3xl bg-surface" />;
  return (
    <div className="pt-2">
      <h1 className="display mb-3 text-3xl font-bold uppercase tracking-wide">Coach</h1>
      <ReviewSection data={data} />
      <BodySection data={data} />
      <StepsSection data={data} />
      <ProfileSection data={data} />
    </div>
  );
}

/* ---- profile ----------------------------------------------------------- */

/**
 * The standing brief the coach reads before every review: the goal, and the
 * injuries and limits that rule advice out. Editable here rather than buried in
 * a file on the laptop, so a tweak noticed mid-session gets recorded on the spot
 * and is waiting the next time a review runs.
 */
function ProfileSection({ data }: { data: AppData }) {
  const { goal, constraints } = data.profile;
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState(goal);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const saveGoal = () => {
    setGoal(goalDraft);
    setEditingGoal(false);
  };

  const saveConstraint = () => {
    addConstraint(draft);
    setDraft("");
    setAdding(false);
  };

  return (
    <section className="mt-4 rounded-3xl border border-line-soft bg-surface p-4">
      <header className="mb-3">
        <h2 className="display text-lg font-semibold uppercase tracking-wide">Profile</h2>
        <p className="text-[11px] text-faint">What the coach works from</p>
      </header>

      <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">Goal</h3>
      {editingGoal ? (
        <div className="flex gap-2">
          <input
            autoFocus
            value={goalDraft}
            onChange={(e) => setGoalDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveGoal()}
            placeholder="e.g. hold weight, grow legs"
            className="min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-volt/50"
          />
          <button
            type="button"
            onClick={saveGoal}
            className="shrink-0 rounded-xl border border-volt/40 bg-volt/10 px-3 text-sm font-semibold text-volt"
          >
            Save
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setGoalDraft(goal);
            setEditingGoal(true);
          }}
          className="w-full rounded-xl border border-line-soft bg-surface-2 px-3 py-2 text-left text-sm text-muted transition-colors duration-150 active:border-volt/40"
        >
          {goal || <span className="text-faint">Tap to set your goal</span>}
        </button>
      )}

      <h3 className="mb-1.5 mt-4 text-[11px] font-semibold uppercase tracking-wide text-faint">
        Injuries and limits
      </h3>
      <ul className="space-y-1">
        {constraints.map((c, i) => (
          <li
            key={c}
            className="flex items-start gap-2 rounded-xl border border-line-soft bg-surface-2 px-3 py-2"
          >
            <span className="min-w-0 flex-1 text-sm leading-relaxed text-muted">{c}</span>
            <button
              type="button"
              aria-label={`Remove "${c}"`}
              onClick={() => removeConstraint(i)}
              className="shrink-0 text-faint transition-colors duration-150 hover:text-warn"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>

      {adding ? (
        <div className="mt-2 flex gap-2">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveConstraint()}
            placeholder="e.g. right biceps tendon, painful under load"
            className="min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-volt/50"
          />
          <button
            type="button"
            onClick={saveConstraint}
            className="shrink-0 rounded-xl border border-volt/40 bg-volt/10 px-3 text-sm font-semibold text-volt"
          >
            Add
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-2 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line px-3 text-sm font-semibold text-muted transition-colors duration-150 hover:text-ink"
        >
          <PlusIcon className="h-4 w-4" /> Add a limit
        </button>
      )}
    </section>
  );
}

/* ---- review ------------------------------------------------------------ */

const AREA_LABEL: Record<CoachRec["area"], string> = {
  weight: "Load",
  reps: "Reps",
  sets: "Sets",
  exercise: "Exercise",
  sequencing: "Sequencing",
  volume: "Volume",
  balance: "Balance",
  recovery: "Recovery",
};

function ReviewSection({ data }: { data: AppData }) {
  const review = useMemo(() => latestReview(data), [data]);

  if (!review) {
    return (
      <section className="rounded-3xl border border-line-soft bg-surface p-4">
        <header className="mb-2 flex items-center gap-2">
          <SparkIcon className="h-5 w-5 text-volt" />
          <h2 className="display text-lg font-semibold uppercase tracking-wide">Review</h2>
        </header>
        <p className="text-sm text-muted">
          No review yet. The coach is Claude running locally against your full training
          history, InBody scans and activity data. Its next review lands here after sync.
        </p>
      </section>
    );
  }

  return <ReviewView data={data} review={review} />;
}

function ReviewView({ data, review }: { data: AppData; review: CoachReview }) {
  const recs = useMemo(
    () => [...review.recommendations].sort((a, b) => a.priority - b.priority),
    [review]
  );

  const context = (r: CoachRec): string | null => {
    const parts: string[] = [];
    if (r.exerciseId && data.exercises[r.exerciseId]) parts.push(data.exercises[r.exerciseId].name);
    if (r.dayId) {
      const day = data.days.find((d) => d.id === r.dayId);
      if (day) parts.push(day.name);
    }
    return parts.length ? parts.join(" · ") : null;
  };

  return (
    <section className="rounded-3xl border border-line-soft bg-surface p-4">
      <header className="mb-1 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <SparkIcon className="h-5 w-5 text-volt" />
          <h2 className="display text-lg font-semibold uppercase tracking-wide">Review</h2>
        </span>
        <span className="text-[11px] text-faint">{fmtDate(review.generatedAt)}</span>
      </header>

      <p className="display text-xl font-bold leading-snug">{review.headline}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">{review.summary}</p>

      <div className="mt-4 space-y-2">
        {recs.map((r) => (
          <div
            key={r.id}
            className={`rounded-2xl border p-3 ${
              r.priority === 1 ? "border-volt/35 bg-volt/5" : "border-line-soft bg-surface-2"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="rounded-md border border-volt/50 bg-volt/12 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-volt">
                {AREA_LABEL[r.area] ?? r.area}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{r.title}</span>
              {r.priority === 1 && (
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-volt">
                  Do first
                </span>
              )}
            </div>
            {context(r) && <p className="mt-1 text-xs text-faint">{context(r)}</p>}
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{r.detail}</p>
          </div>
        ))}
      </div>

      {review.watch && review.watch.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
            Keeping an eye on
          </h3>
          <ul className="space-y-1">
            {review.watch.map((w, i) => (
              <li key={i} className="text-sm leading-relaxed text-muted">
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/* ---- body (InBody) ----------------------------------------------------- */

type BodyMetric = "weightKg" | "smmKg" | "pbf";

const METRICS: Array<{ key: BodyMetric; label: string; unit: string }> = [
  { key: "weightKg", label: "Weight", unit: "kg" },
  { key: "smmKg", label: "Muscle", unit: "kg" },
  { key: "pbf", label: "Body fat", unit: "%" },
];

function BodySection({ data }: { data: AppData }) {
  const series = useMemo(() => inbodySeries(data), [data]);
  const [metric, setMetric] = useState<BodyMetric>("smmKg");

  if (series.length === 0) return null;

  const latest = series[series.length - 1];
  const prev = series.length > 1 ? series[series.length - 2] : null;
  const points = series.map((e) => ({ t: new Date(e.date).getTime(), w: e[metric] ?? 0 }));
  const active = METRICS.find((m) => m.key === metric);

  return (
    <section className="mt-4 rounded-3xl border border-line-soft bg-surface p-4">
      <header className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="display text-lg font-semibold uppercase tracking-wide">Body</h2>
        <span className="text-[11px] text-faint">InBody · {fmtDate(latest.date)}</span>
      </header>

      <div className="grid grid-cols-3 gap-2">
        {METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            aria-pressed={metric === m.key}
            onClick={() => setMetric(m.key)}
            className={`rounded-2xl border p-3 text-center transition-colors duration-150 ${
              metric === m.key ? "border-volt/40 bg-volt/8" : "border-line-soft bg-surface-2"
            }`}
          >
            <p className={`num display text-xl font-bold leading-none ${metric === m.key ? "text-volt" : "text-ink"}`}>
              {latest[m.key]?.toFixed(1)}
            </p>
            <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-muted">
              {m.label}
            </p>
            {prev && latest[m.key] != null && prev[m.key] != null && (
              <Delta now={latest[m.key]!} before={prev[m.key]!} />
            )}
          </button>
        ))}
      </div>

      {points.length >= 2 && (
        <div className="mt-3">
          <TopSetChart
            points={points}
            unit={active?.unit ?? "kg"}
            label={`${active?.label ?? "Body"} trend`}
          />
        </div>
      )}

      <SegmentalTiles latest={latest} />
    </section>
  );
}

function Delta({ now, before }: { now: number; before: number }) {
  const d = Math.round((now - before) * 10) / 10;
  if (d === 0) {
    return <p className="num mt-0.5 text-[10px] text-faint">=</p>;
  }
  return (
    <p
      className={`num mt-0.5 flex items-center justify-center gap-0.5 text-[10px] font-semibold ${
        d > 0 ? "text-volt" : "text-muted"
      }`}
    >
      {d > 0 ? (
        <TriangleUpIcon className="h-2.5 w-2.5" />
      ) : (
        <TriangleDownIcon className="h-2.5 w-2.5" />
      )}
      {Math.abs(d)}
    </p>
  );
}

/** InBody's own bands for segmental lean mass vs the ideal. */
function segmentStatus(pct: number): { label: string; cls: string } {
  if (pct > 110) return { label: "Over", cls: "text-volt" };
  if (pct < 90) return { label: "Under", cls: "text-amber" };
  return { label: "Normal", cls: "text-muted" };
}

function SegmentalTiles({ latest }: { latest: InBodyEntry }) {
  const s = latest.segmentalLean;
  if (!s) return null;
  const parts = [
    { label: "Arms", pct: s.arms, Icon: ArmsIcon },
    { label: "Trunk", pct: s.trunk, Icon: TrunkIcon },
    { label: "Legs", pct: s.legs, Icon: LegsIcon },
  ];
  return (
    <div className="mt-3">
      <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
        Muscle by region · % of ideal
      </h3>
      <div className="grid grid-cols-3 gap-2">
        {parts.map(({ label, pct, Icon }) => {
          const status = segmentStatus(pct);
          return (
            <div
              key={label}
              className="rounded-2xl border border-line-soft bg-surface-2 p-3 text-center"
            >
              <Icon className={`mx-auto h-6 w-6 ${status.cls}`} />
              <p className="num display mt-1.5 text-lg font-bold leading-none">{pct.toFixed(0)}%</p>
              <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-muted">
                {label}
              </p>
              <p className={`text-[10px] font-semibold uppercase tracking-wide ${status.cls}`}>
                {status.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---- steps ------------------------------------------------------------- */

function StepsSection({ data }: { data: AppData }) {
  const steps = useMemo(() => latestStepWeek(data), [data]);
  if (!steps) return null;
  return (
    <section className="mt-4 rounded-3xl border border-line-soft bg-surface p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="display text-lg font-semibold uppercase tracking-wide">Steps</h2>
          <p className="text-[11px] text-faint">week of {fmtDate(steps.weekStart)}</p>
        </div>
        <p className="num display text-2xl font-bold">
          {Math.round(steps.avgSteps).toLocaleString("en-GB")}
          <span className="ml-1 text-[10px] font-medium uppercase text-faint">avg/day</span>
        </p>
      </div>
    </section>
  );
}
