"use client";

import { useMemo, useState } from "react";
import { useAppData } from "@/lib/store";
import type { AppData, CoachRec, CoachReview, InBodyEntry, PlanChange } from "@/lib/types";
import {
  addConstraint,
  applyChange,
  changeApplied,
  changeUsable,
  dayLabel,
  describeChange,
  inbodySeries,
  latestReview,
  latestStepWeek,
  removeConstraint,
  setGoal,
} from "@/lib/coach";
import { TopSetChart } from "@/components/charts";
import {
  ArmsIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
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

const CARD = "rounded-3xl border border-line-soft bg-surface p-4";

export default function CoachPage() {
  const data = useAppData();
  const review = useMemo(() => (data ? latestReview(data) : null), [data]);
  if (!data) return <div className="h-48 animate-pulse rounded-3xl bg-surface" />;
  return (
    <div className="space-y-4 pt-2">
      <h1 className="display text-3xl font-bold uppercase tracking-wide">Coach</h1>
      <BodySection data={data} />
      {review ? (
        <>
          <VerdictSection review={review} />
          <ActionsSection data={data} review={review} />
          <WatchSection review={review} />
        </>
      ) : (
        <EmptyReview />
      )}
      <StepsSection data={data} />
      <ProfileSection data={data} />
    </div>
  );
}

/* ---- shared ------------------------------------------------------------ */

/**
 * Collapsed by default everywhere on this page. The reviews are long on purpose
 * — the reasoning is the point — but a phone screen of unbroken prose doesn't
 * get read, so nothing long is visible until it's asked for.
 */
function Expander({
  open,
  onToggle,
  label,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-faint transition-colors duration-150 hover:text-ink"
      >
        {open ? "Less" : label}
        {open ? <ChevronUpIcon className="h-3.5 w-3.5" /> : <ChevronDownIcon className="h-3.5 w-3.5" />}
      </button>
      {open && <div className="mt-2 text-sm leading-relaxed text-muted">{children}</div>}
    </>
  );
}

/* ---- verdict ----------------------------------------------------------- */

function EmptyReview() {
  return (
    <section className={CARD}>
      <header className="mb-2 flex items-center gap-2">
        <SparkIcon className="h-5 w-5 text-volt" />
        <h2 className="display text-lg font-semibold uppercase tracking-wide">Review</h2>
      </header>
      <p className="text-sm text-muted">
        No review yet. The coach is Claude running locally against your full training history,
        InBody scans and activity data. Its next review lands here after sync.
      </p>
    </section>
  );
}

/** Headline, the short version as bullets, and the full assessment behind a tap. */
function VerdictSection({ review }: { review: CoachReview }) {
  const [open, setOpen] = useState(false);
  const bullets = review.tldr ?? [];

  return (
    <section className={CARD}>
      <header className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <SparkIcon className="h-5 w-5 text-volt" />
          <h2 className="display text-lg font-semibold uppercase tracking-wide">Review</h2>
        </span>
        <span className="text-[11px] text-faint">{fmtDate(review.generatedAt)}</span>
      </header>

      <p className="display text-lg font-bold leading-snug">{review.headline}</p>

      {bullets.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {bullets.map((b, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed text-muted">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-volt" />
              <span className="min-w-0">{b}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3">
        <Expander open={open} onToggle={() => setOpen(!open)} label="Full assessment">
          {review.summary}
        </Expander>
      </div>
    </section>
  );
}

/* ---- actions ----------------------------------------------------------- */

const AREA_LABEL: Record<CoachRec["area"], string> = {
  weight: "Load",
  reps: "Reps",
  sets: "Sets",
  exercise: "Exercise",
  sequencing: "Order",
  volume: "Volume",
  balance: "Balance",
  recovery: "Recovery",
};

/**
 * Only the "do first" set is on screen at rest. A full review runs to a dozen
 * recommendations, which on a phone is a wall nobody reads to the end of — and
 * the ranking exists precisely so everything below the top few can wait.
 */
function ActionsSection({ data, review }: { data: AppData; review: CoachReview }) {
  const recs = useMemo(
    () => [...review.recommendations].sort((a, b) => a.priority - b.priority),
    [review]
  );
  const [showAll, setShowAll] = useState(false);

  const first = recs.filter((r) => r.priority === 1);
  // Nothing ranked first means nothing to hold back — show the lot.
  const shown = showAll || first.length === 0 ? recs : first;
  const hidden = recs.length - shown.length;

  return (
    <section className={CARD}>
      <header className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="display text-lg font-semibold uppercase tracking-wide">What to change</h2>
        <span className="text-[11px] text-faint">
          {shown.length} of {recs.length}
        </span>
      </header>
      <div className="space-y-2">
        {shown.map((r) => (
          <RecCard key={r.id} data={data} rec={r} />
        ))}
      </div>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-2 flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-line text-sm font-semibold text-muted transition-colors duration-150 hover:text-ink"
        >
          Show {hidden} more <ChevronDownIcon className="h-4 w-4" />
        </button>
      )}
      {showAll && first.length > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(false)}
          className="mt-2 flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-line text-sm font-semibold text-muted transition-colors duration-150 hover:text-ink"
        >
          Show less <ChevronUpIcon className="h-4 w-4" />
        </button>
      )}
    </section>
  );
}

function RecCard({ data, rec }: { data: AppData; rec: CoachRec }) {
  const [open, setOpen] = useState(false);

  const parts: string[] = [];
  if (rec.exerciseId && data.exercises[rec.exerciseId])
    parts.push(data.exercises[rec.exerciseId].name);
  if (rec.dayId && data.days.some((d) => d.id === rec.dayId))
    parts.push(dayLabel(data, rec.dayId));
  const where = parts.length ? parts.join(" · ") : null;

  return (
    <article
      className={`rounded-2xl border p-3 ${
        rec.priority === 1 ? "border-volt/35 bg-volt/5" : "border-line-soft bg-surface-2"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="rounded-md border border-volt/50 bg-volt/12 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-volt">
          {AREA_LABEL[rec.area] ?? rec.area}
        </span>
        {rec.priority === 1 && (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-volt">
            Do first
          </span>
        )}
        {where && <span className="min-w-0 flex-1 truncate text-right text-[10px] text-faint">{where}</span>}
      </div>

      {/* Wraps rather than truncates: the title is the one line that has to
          survive a narrow screen intact, so it's kept short at the source. */}
      <h3 className="mt-1.5 text-sm font-semibold leading-snug">{rec.title}</h3>
      {rec.tldr && <p className="mt-1 text-sm leading-relaxed text-muted">{rec.tldr}</p>}

      <div className="mt-2">
        <Expander open={open} onToggle={() => setOpen(!open)} label="Why">
          {rec.detail}
        </Expander>
      </div>

      {rec.change && <ApplyRow data={data} change={rec.change} />}
    </article>
  );
}

/**
 * The one-tap path from advice to plan. Only appears when the change still
 * points at a day and exercises that exist, and it states in full what the tap
 * will do — the sentence is generated from the same change object that gets
 * applied, so it can't describe something else.
 */
function ApplyRow({ data, change }: { data: AppData; change: PlanChange }) {
  if (!changeUsable(data, change)) return null;
  const done = changeApplied(data, change);
  const what = describeChange(data, change);

  if (done) {
    return (
      <p className="mt-2.5 flex items-center gap-1.5 border-t border-line-soft pt-2.5 text-[11px] font-semibold uppercase tracking-wide text-volt">
        <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.6} /> In your plan
      </p>
    );
  }

  return (
    <div className="mt-2.5 border-t border-line-soft pt-2.5">
      <p className="text-xs leading-relaxed text-faint">{what}</p>
      <button
        type="button"
        onClick={() => {
          if (confirm(`${what}\n\nAdd this to your plan?`)) applyChange(change);
        }}
        className="mt-2 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-volt text-sm font-semibold text-volt-ink transition-colors duration-150"
      >
        <CheckIcon className="h-4 w-4" strokeWidth={2.6} /> Apply to plan
      </button>
    </div>
  );
}

/* ---- watch ------------------------------------------------------------- */

function WatchSection({ review }: { review: CoachReview }) {
  const items = review.watch ?? [];
  if (!items.length) return null;
  return (
    <section className={CARD}>
      <header className="mb-3">
        <h2 className="display text-lg font-semibold uppercase tracking-wide">Keeping an eye on</h2>
        <p className="text-[11px] text-faint">Not actions. Context for next time.</p>
      </header>
      <ul className="space-y-2">
        {items.map((w, i) => (
          <WatchItem key={i} text={w} />
        ))}
      </ul>
    </section>
  );
}

/** First sentence at rest, the rest on tap. Keeps the box to a few lines. */
function WatchItem({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const cut = text.indexOf(". ");
  const head = cut > 0 ? text.slice(0, cut + 1) : text;
  const rest = cut > 0 ? text.slice(cut + 2) : "";

  return (
    <li className="rounded-2xl border border-line-soft bg-surface-2 p-3">
      <p className="text-sm leading-relaxed text-muted">{head}</p>
      {rest && (
        <div className="mt-1.5">
          <Expander open={open} onToggle={() => setOpen(!open)} label="More">
            {rest}
          </Expander>
        </div>
      )}
    </li>
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
    <section className={CARD}>
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
  const [open, setOpen] = useState(false);
  if (!s) return null;
  const parts = [
    { label: "Arms", pct: s.arms, Icon: ArmsIcon },
    { label: "Trunk", pct: s.trunk, Icon: TrunkIcon },
    { label: "Legs", pct: s.legs, Icon: LegsIcon },
  ];
  return (
    <div className="mt-3">
      <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
        Muscle by region
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
      {/* The number people misread. 100% is measured against what InBody expects
          for this person's own height and weight, so it says nothing about how
          they compare to anyone else. Worth one tap to explain, every time. */}
      <div className="mt-2">
        <Expander open={open} onToggle={() => setOpen(!open)} label="What % means">
          These are measured against what InBody expects for your own height and weight, not
          against other people. 100% means that region carries exactly the muscle your body size
          calls for. It also moves: every kilo you add to your trunk raises the bar your arms and
          legs are measured against.
        </Expander>
      </div>
    </div>
  );
}

/* ---- steps ------------------------------------------------------------- */

function StepsSection({ data }: { data: AppData }) {
  const steps = useMemo(() => latestStepWeek(data), [data]);
  if (!steps) return null;
  return (
    <section className={CARD}>
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
    <section className={CARD}>
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
