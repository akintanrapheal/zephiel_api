"use client";

import { useState } from "react";

export type UsagePoint = { date: string; calls: number };

const fmt = (n: number) => n.toLocaleString();

/**
 * Single-series magnitude chart: one hue, baseline-anchored bars with rounded
 * data-ends, recessive grid, per-bar hover tooltip. No legend — the title names
 * the series.
 */
export default function UsageChart({ data }: { data: UsagePoint[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const max = Math.max(...data.map((d) => d.calls));
  const ceiling = Math.ceil(max / 5000) * 5000;
  const W = 720;
  const H = 200;
  const padY = 8;
  const slot = W / data.length;
  const barW = Math.max(4, slot - 3); // 2-3px surface gap between adjacent bars

  const gridlines = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="relative">
      <div className="flex items-baseline justify-between">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-ink">API calls</h3>
          <p className="mt-0.5 text-xs text-muted">Last 30 days, all APIs</p>
        </div>
        <p className="text-2xl font-semibold tracking-tight text-ink">
          {fmt(data.reduce((s, d) => s + d.calls, 0))}
        </p>
      </div>

      <div className="mt-5 flex gap-3">
        <div className="flex h-[200px] w-12 shrink-0 flex-col justify-between py-1 text-right text-[10px] tabular-nums text-muted">
          <span>{fmt(ceiling)}</span>
          <span>{fmt(ceiling / 2)}</span>
          <span>0</span>
        </div>

        <div className="relative min-w-0 flex-1">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-[200px] w-full overflow-visible"
            role="img"
            aria-label={`Daily API calls over the last 30 days, peaking at ${fmt(max)} calls`}
            onMouseLeave={() => setHover(null)}
          >
            {gridlines.map((g) => (
              <line
                key={g}
                x1={0}
                x2={W}
                y1={padY + (H - padY * 2) * g}
                y2={padY + (H - padY * 2) * g}
                className="stroke-line"
                strokeWidth={1}
              />
            ))}

            {data.map((d, i) => {
              const h = ((H - padY * 2) * d.calls) / ceiling;
              const x = i * slot + (slot - barW) / 2;
              const y = H - padY - h;
              return (
                <g key={d.date}>
                  <rect
                    x={x}
                    y={y}
                    width={barW}
                    height={h}
                    rx={3}
                    className={
                      hover === null || hover === i
                        ? "fill-brand-500 dark:fill-brand-400"
                        : "fill-brand-500/40 dark:fill-brand-400/40"
                    }
                  />
                  {/* Hit target spans the full column height */}
                  <rect
                    x={i * slot}
                    y={0}
                    width={slot}
                    height={H}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                  />
                </g>
              );
            })}

            <line x1={0} x2={W} y1={H - padY} y2={H - padY} className="stroke-line" strokeWidth={1} />
          </svg>

          {hover !== null && (
            <div
              className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-line bg-surface px-3 py-2 shadow-lift"
              style={{ left: `${((hover + 0.5) / data.length) * 100}%` }}
            >
              <p className="text-[11px] text-muted">{data[hover].date}</p>
              <p className="text-sm font-semibold tabular-nums text-ink">{fmt(data[hover].calls)} calls</p>
            </div>
          )}

          <div className="mt-2 flex justify-between text-[10px] text-muted">
            <span>{data[0].date}</span>
            <span>{data[Math.floor(data.length / 2)].date}</span>
            <span>{data[data.length - 1].date}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
