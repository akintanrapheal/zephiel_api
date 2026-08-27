"use client";

import { useMemo, useState } from "react";

/**
 * Categorical palette, validated with the dataviz palette checker for both
 * surfaces (lightness band, chroma floor, CVD separation, contrast). Hues are
 * assigned in fixed order and never cycled — a store keeps its colour when
 * others are added or removed.
 */
const SERIES_LIGHT = ["#2445d6", "#d97706", "#0891b2", "#be123c", "#7c3aed", "#65a30d"];
const SERIES_DARK = ["#5b85fc", "#bd7a00", "#0d9db5", "#d95a70", "#8a6ae6", "#729c1c"];

export type ActivitySeries = { id: string; name: string; values: number[] };

const W = 760;
const H = 240;
const PAD = { top: 12, right: 16, bottom: 24, left: 40 };

export default function StoreActivityChart({
  buckets,
  series,
}: {
  buckets: string[];
  series: ActivitySeries[];
}) {
  const [hover, setHover] = useState<number | null>(null);

  const max = useMemo(
    () => Math.max(1, ...series.flatMap((s) => s.values)),
    [series]
  );
  const ceiling = Math.max(4, Math.ceil(max * 1.15));

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const x = (i: number) => PAD.left + (buckets.length <= 1 ? 0 : (i / (buckets.length - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - (v / ceiling) * plotH;

  const label = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  if (buckets.length === 0 || series.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted">
        No stores connected yet — activity appears here once a store key starts making calls.
      </p>
    );
  }

  const totalCalls = series.reduce((sum, s) => sum + s.values.reduce((a, b) => a + b, 0), 0);

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-ink">Calls per store</h3>
          <p className="mt-0.5 text-xs text-muted">
            Five-minute buckets · {label(buckets[0])}–{label(buckets[buckets.length - 1])}
          </p>
        </div>
        <p className="text-sm font-semibold tabular-nums text-ink">
          {totalCalls.toLocaleString()} calls
        </p>
      </div>

      {/* Legend — identity is never carried by colour alone. */}
      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
        {series.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2 text-xs text-ink">
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: `var(--series-${i})` }}
            />
            {s.name}
          </li>
        ))}
      </ul>

      {/* Series colours as CSS variables so each theme gets its own validated step. */}
      <style>{`
        .store-chart { ${SERIES_LIGHT.map((c, i) => `--series-${i}:${c};`).join("")} }
        .dark .store-chart { ${SERIES_DARK.map((c, i) => `--series-${i}:${c};`).join("")} }
      `}</style>

      <div className="store-chart relative mt-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Calls per store in five-minute buckets. ${series
            .map((s) => `${s.name}: ${s.values.reduce((a, b) => a + b, 0)} calls`)
            .join(". ")}`}
          onMouseLeave={() => setHover(null)}
        >
          {/* Recessive gridlines and axis labels */}
          {[0, 0.5, 1].map((g) => {
            const gy = PAD.top + plotH * (1 - g);
            return (
              <g key={g}>
                <line x1={PAD.left} x2={W - PAD.right} y1={gy} y2={gy} className="stroke-line" strokeWidth={1} />
                <text x={PAD.left - 8} y={gy + 3} textAnchor="end" className="fill-muted" fontSize={10}>
                  {Math.round(ceiling * g)}
                </text>
              </g>
            );
          })}

          {series.map((s, i) => {
            const d = s.values
              .map((v, idx) => `${idx === 0 ? "M" : "L"}${x(idx).toFixed(1)},${y(v).toFixed(1)}`)
              .join(" ");
            return (
              <path
                key={s.id}
                d={d}
                fill="none"
                stroke={`var(--series-${i})`}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={hover === null ? 1 : 0.9}
              />
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
              />
              {series.map((s, i) => (
                <circle
                  key={s.id}
                  cx={x(hover)}
                  cy={y(s.values[hover] ?? 0)}
                  r={4}
                  fill={`var(--series-${i})`}
                  className="stroke-surface"
                  strokeWidth={2}
                />
              ))}
            </>
          )}

          {/* Full-height hit targets, wider than the marks themselves. */}
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
            className="pointer-events-none absolute top-2 z-10 -translate-x-1/2 rounded-lg border border-line bg-surface px-3 py-2 shadow-lift"
            style={{ left: `${(x(hover) / W) * 100}%` }}
          >
            <p className="text-[11px] text-muted">{label(buckets[hover])}</p>
            <ul className="mt-1 space-y-0.5">
              {series.map((s, i) => (
                <li key={s.id} className="flex items-center gap-2 whitespace-nowrap text-xs">
                  <span
                    aria-hidden
                    className="h-2 w-2 shrink-0 rounded-sm"
                    style={{ background: `var(--series-${i})` }}
                  />
                  <span className="text-muted">{s.name}</span>
                  <span className="ml-auto font-semibold tabular-nums text-ink">
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
