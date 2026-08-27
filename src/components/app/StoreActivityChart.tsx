"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Categorical palette, validated with the dataviz palette checker for both
 * surfaces (lightness band, chroma floor, CVD separation, contrast). Hues are
 * assigned in fixed order and never cycled — a store keeps its colour when
 * others are added or removed.
 */
const SERIES_LIGHT = ["#2445d6", "#d97706", "#0891b2", "#be123c", "#7c3aed", "#65a30d"];
const SERIES_DARK = ["#5b85fc", "#bd7a00", "#0d9db5", "#d95a70", "#8a6ae6", "#729c1c"];

export type ActivitySeries = { id: string; name: string; values: number[] };

const W = 820;
const H = 260;
const PAD = { top: 16, right: 20, bottom: 28, left: 44 };

export default function StoreActivityChart({
  buckets,
  series,
}: {
  buckets: string[];
  series: ActivitySeries[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [isolated, setIsolated] = useState<string | null>(null);
  const [smooth, setSmooth] = useState(true);

  const shown = isolated ? series.filter((s) => s.id === isolated) : series;

  const max = useMemo(() => Math.max(1, ...shown.flatMap((s) => s.values)), [shown]);
  const ceiling = Math.max(4, Math.ceil(max * 1.15));

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const x = (i: number) => PAD.left + (buckets.length <= 1 ? 0 : (i / (buckets.length - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - (v / ceiling) * plotH;

  const label = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  /** Catmull-Rom smoothing, clamped so the curve never dips below zero. */
  const path = (values: number[]) => {
    const pts = values.map((v, i) => [x(i), y(v)] as const);
    if (pts.length < 2) return "";
    if (!smooth) return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");

    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];

      const c1x = p1[0] + (p2[0] - p0[0]) / 6;
      const c1y = Math.min(PAD.top + plotH, Math.max(PAD.top, p1[1] + (p2[1] - p0[1]) / 6));
      const c2x = p2[0] - (p3[0] - p1[0]) / 6;
      const c2y = Math.min(PAD.top + plotH, Math.max(PAD.top, p2[1] - (p3[1] - p1[1]) / 6));

      d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
  };

  if (buckets.length === 0 || series.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted">
        No stores connected yet — activity appears here once a store key starts making calls.
      </p>
    );
  }

  const totals = series.map((s) => ({
    id: s.id,
    name: s.name,
    total: s.values.reduce((a, b) => a + b, 0),
    peak: Math.max(...s.values),
  }));
  const grandTotal = totals.reduce((a, t) => a + t.total, 0);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-ink">Calls per store</h3>
          <p className="mt-0.5 text-xs text-muted">
            Five-minute buckets · {label(buckets[0])}–{label(buckets[buckets.length - 1])}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setSmooth((v) => !v)}
            aria-pressed={smooth}
            className="rounded-lg border border-line px-2.5 py-1 text-[11px] font-medium text-muted transition hover:text-ink"
          >
            {smooth ? "Smoothed" : "Stepped"}
          </button>
          <p className="text-sm font-semibold tabular-nums text-ink">
            {grandTotal.toLocaleString()} calls
          </p>
        </div>
      </div>

      {/* Legend doubles as a filter: click a store to isolate its line. */}
      <ul className="mt-4 flex flex-wrap gap-2">
        {totals.map((t, i) => {
          const active = isolated === t.id;
          const dimmed = isolated !== null && !active;
          return (
            <li key={t.id}>
              <button
                onClick={() => setIsolated(active ? null : t.id)}
                aria-pressed={active}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition",
                  active ? "border-brand-400 bg-elevated" : "border-line hover:bg-elevated",
                  dimmed && "opacity-45"
                )}
              >
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ background: `var(--series-${i})` }}
                />
                <span className="font-medium text-ink">{t.name}</span>
                <span className="tabular-nums text-muted">{t.total.toLocaleString()}</span>
              </button>
            </li>
          );
        })}
        {isolated && (
          <li>
            <button
              onClick={() => setIsolated(null)}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-600 hover:underline"
            >
              Show all
            </button>
          </li>
        )}
      </ul>

      <style>{`
        .store-chart { ${SERIES_LIGHT.map((c, i) => `--series-${i}:${c};`).join("")} }
        .dark .store-chart { ${SERIES_DARK.map((c, i) => `--series-${i}:${c};`).join("")} }
      `}</style>

      <div className="store-chart relative mt-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Calls per store in five-minute buckets. ${totals
            .map((t) => `${t.name}: ${t.total} calls, peak ${t.peak}`)
            .join(". ")}`}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            {series.map((s, i) => (
              <linearGradient key={s.id} id={`fill-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={`var(--series-${i})`} stopOpacity="0.18" />
                <stop offset="100%" stopColor={`var(--series-${i})`} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>

          {[0, 0.25, 0.5, 0.75, 1].map((g) => {
            const gy = PAD.top + plotH * (1 - g);
            return (
              <g key={g}>
                <line x1={PAD.left} x2={W - PAD.right} y1={gy} y2={gy} className="stroke-line" strokeWidth={1} />
                {(g === 0 || g === 0.5 || g === 1) && (
                  <text x={PAD.left - 8} y={gy + 3} textAnchor="end" className="fill-muted" fontSize={10}>
                    {Math.round(ceiling * g)}
                  </text>
                )}
              </g>
            );
          })}

          {series.map((s, i) => {
            const visible = !isolated || isolated === s.id;
            const d = path(s.values);
            return (
              <g key={s.id} opacity={visible ? 1 : 0.12} style={{ transition: "opacity .2s" }}>
                {/* An area fill only reads cleanly when one line is isolated. */}
                {isolated === s.id && (
                  <path
                    d={`${d} L${x(s.values.length - 1).toFixed(1)},${(PAD.top + plotH).toFixed(1)} L${x(0).toFixed(1)},${(PAD.top + plotH).toFixed(1)} Z`}
                    fill={`url(#fill-${i})`}
                  />
                )}
                <path
                  d={d}
                  fill="none"
                  stroke={`var(--series-${i})`}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            );
          })}

          {hover !== null && (
            <>
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1={PAD.top}
                y2={PAD.top + plotH}
                className="stroke-line"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              {series.map((s, i) =>
                !isolated || isolated === s.id ? (
                  <circle
                    key={s.id}
                    cx={x(hover)}
                    cy={y(s.values[hover] ?? 0)}
                    r={4}
                    fill={`var(--series-${i})`}
                    className="stroke-surface"
                    strokeWidth={2}
                  />
                ) : null
              )}
            </>
          )}

          {buckets.map((b, i) => (
            <rect
              key={b}
              x={x(i) - plotW / buckets.length / 2}
              y={0}
              width={plotW / buckets.length}
              height={H}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          ))}

          <text x={PAD.left} y={H - 6} className="fill-muted" fontSize={10}>
            {label(buckets[0])}
          </text>
          <text x={W - PAD.right} y={H - 6} textAnchor="end" className="fill-muted" fontSize={10}>
            {label(buckets[buckets.length - 1])}
          </text>
        </svg>

        {hover !== null && (
          <div
            className={cn(
              "pointer-events-none absolute top-2 z-10 rounded-xl border border-line bg-surface px-3 py-2 shadow-lift",
              hover > buckets.length / 2 ? "-translate-x-full" : ""
            )}
            style={{ left: `${(x(hover) / W) * 100}%` }}
          >
            <p className="text-[11px] font-medium text-muted">{label(buckets[hover])}</p>
            <ul className="mt-1.5 space-y-1">
              {series
                .map((s, i) => ({ s, i }))
                .filter(({ s }) => !isolated || isolated === s.id)
                .sort((a, b) => (b.s.values[hover] ?? 0) - (a.s.values[hover] ?? 0))
                .map(({ s, i }) => (
                  <li key={s.id} className="flex items-center gap-2.5 whitespace-nowrap text-xs">
                    <span
                      aria-hidden
                      className="h-2 w-2 shrink-0 rounded-sm"
                      style={{ background: `var(--series-${i})` }}
                    />
                    <span className="text-muted">{s.name}</span>
                    <span className="ml-auto pl-3 font-semibold tabular-nums text-ink">
                      {s.values[hover] ?? 0}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
