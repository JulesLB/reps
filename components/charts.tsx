"use client";

import { useMemo, useRef, useState } from "react";
import type { SeriesPoint } from "@/lib/logic";
import { formatWeight } from "@/lib/logic";

const W = 340;
const H = 170;
const PAD = { top: 14, right: 16, bottom: 24, left: 34 };

export function TopSetChart({ points, unit }: { points: SeriesPoint[]; unit: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const { xs, ys, ticks } = useMemo(() => {
    const t0 = points[0]?.t ?? 0;
    const t1 = points[points.length - 1]?.t ?? 1;
    const span = Math.max(t1 - t0, 1);
    const ws = points.map((p) => p.w);
    const lo = Math.min(...ws);
    const hi = Math.max(...ws);
    const pad = Math.max((hi - lo) * 0.25, 2.5);
    const y0 = Math.max(0, lo - pad);
    const y1 = hi + pad;
    const xs = points.map((p) => PAD.left + ((p.t - t0) / span) * (W - PAD.left - PAD.right));
    const ys = points.map((p) => PAD.top + (1 - (p.w - y0) / (y1 - y0)) * (H - PAD.top - PAD.bottom));
    const ticks = [y0, (y0 + y1) / 2, y1].map((v) => ({
      v: Math.round(v / 2.5) * 2.5,
      y: PAD.top + (1 - (v - y0) / (y1 - y0)) * (H - PAD.top - PAD.bottom),
    }));
    return { xs, ys, ticks };
  }, [points]);

  if (points.length < 2) {
    return (
      <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-line text-sm text-faint">
        Log this exercise twice to see a trend.
      </div>
    );
  }

  const onMove = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - x) < Math.abs(xs[best] - x)) best = i;
    setHover(best);
  };

  const path = xs.map((x, i) => `${i ? "L" : "M"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const area = `${path} L${xs[xs.length - 1].toFixed(1)},${H - PAD.bottom} L${xs[0].toFixed(1)},${H - PAD.bottom} Z`;
  const last = points.length - 1;
  const fmtDate = (t: number) =>
    new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  return (
    <div className="relative">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none select-none"
        role="img"
        aria-label={`Top set weight trend, currently ${formatWeight(points[last].w)} ${unit}`}
        onPointerMove={(e) => onMove(e.clientX)}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--volt)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--volt)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={W - PAD.right} y1={t.y} y2={t.y} stroke="var(--line-soft)" strokeWidth="1" />
            <text x={PAD.left - 6} y={t.y + 3.5} textAnchor="end" fontSize="10" fill="var(--faint)" className="num">
              {formatWeight(t.v)}
            </text>
          </g>
        ))}
        <text x={PAD.left} y={H - 8} fontSize="10" fill="var(--faint)">{fmtDate(points[0].t)}</text>
        <text x={W - PAD.right} y={H - 8} textAnchor="end" fontSize="10" fill="var(--faint)">
          {fmtDate(points[last].t)}
        </text>

        <path d={area} fill="url(#areaFill)" />
        <path d={path} fill="none" stroke="var(--volt)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {hover !== null && (
          <line x1={xs[hover]} x2={xs[hover]} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--line)" strokeWidth="1" />
        )}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={xs[i]}
            cy={ys[i]}
            r={i === hover ? 5 : 3.5}
            fill="var(--volt)"
            stroke="var(--surface)"
            strokeWidth="2"
          />
        ))}
        <text
          x={Math.min(xs[last], W - PAD.right - 4)}
          y={ys[last] - 9}
          textAnchor="end"
          fontSize="12"
          fontWeight="700"
          fill="var(--text)"
          className="num"
        >
          {formatWeight(points[last].w)} {unit}
        </text>
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute -top-1 rounded-lg border border-line bg-surface-2 px-2 py-1 text-xs shadow-lg"
          style={{
            left: `${(xs[hover] / W) * 100}%`,
            transform: `translateX(${xs[hover] > W * 0.7 ? "-100%" : "-50%"})`,
          }}
        >
          <span className="num font-semibold">{formatWeight(points[hover].w)} {unit}</span>
          <span className="ml-1.5 text-faint">{fmtDate(points[hover].t)}</span>
        </div>
      )}
    </div>
  );
}

const BAND_LO = 10;
const BAND_HI = 20;

export function MuscleVolumeBars({ counts, muscles }: { counts: Record<string, number>; muscles: string[] }) {
  const max = Math.max(BAND_HI + 4, ...muscles.map((m) => counts[m] ?? 0));
  return (
    <div>
      <div className="space-y-2.5">
        {muscles.map((m) => {
          const n = counts[m] ?? 0;
          const inBand = n >= BAND_LO && n <= BAND_HI;
          return (
            <div key={m} className="flex items-center gap-3">
              <span className="w-20 shrink-0 text-right text-xs font-medium capitalize text-muted">{m}</span>
              <div className="relative h-4 flex-1 overflow-hidden rounded-md bg-surface-2">
                <div
                  className="absolute inset-y-0 border-x border-line"
                  style={{ left: `${(BAND_LO / max) * 100}%`, width: `${((BAND_HI - BAND_LO) / max) * 100}%`, background: "var(--line-soft)" }}
                  aria-hidden
                />
                <div
                  className="absolute inset-y-[3px] left-0 rounded-r-[4px] transition-all duration-300"
                  style={{ width: `calc(${(Math.min(n, max) / max) * 100}% )`, background: "var(--volt)", opacity: n === 0 ? 0 : 1 }}
                />
              </div>
              <span className={`num w-8 shrink-0 text-right text-sm font-semibold ${inBand ? "text-ink" : n === 0 ? "text-faint" : "text-muted"}`}>
                {Number.isInteger(n) ? n : n.toFixed(1)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
