"use client";

import { useMemo, useState } from "react";
import UsageChart, { type UsagePoint } from "@/components/UsageChart";
import { compact } from "@/lib/utils";
import { cn } from "@/lib/utils";

const ranges = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
] as const;

/**
 * The full 90-day series is fetched once and sliced in the browser, so
 * switching range is instant rather than a round trip.
 */
export default function UsageExplorer({
  series,
  byApi,
}: {
  series: UsagePoint[];
  byApi: { name: string; color: string; calls: number }[];
}) {
  const [days, setDays] = useState<number>(30);

  const shown = useMemo(() => series.slice(-days), [series, days]);
  const total = useMemo(() => shown.reduce((sum, d) => sum + d.calls, 0), [shown]);
  const peak = useMemo(() => Math.max(0, ...shown.map((d) => d.calls)), [shown]);
  const average = shown.length ? Math.round(total / shown.length) : 0;
  const maxApi = Math.max(1, ...byApi.map((a) => a.calls));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Time range" className="flex gap-1 rounded-xl border border-line bg-surface p-1">
          {ranges.map((r) => (
            <button
              key={r.days}
              onClick={() => setDays(r.days)}
              aria-pressed={days === r.days}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                days === r.days ? "bg-brand-600 text-white" : "text-muted hover:text-ink"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>

        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted" aria-live="polite">
          <div className="flex gap-1.5">
            <dt>Total</dt>
            <dd className="font-semibold tabular-nums text-ink">{compact(total)}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>Daily average</dt>
            <dd className="font-semibold tabular-nums text-ink">{compact(average)}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>Peak day</dt>
            <dd className="font-semibold tabular-nums text-ink">{compact(peak)}</dd>
          </div>
        </dl>
      </div>

      <section className="rounded-2xl border border-line bg-surface p-6">
        <UsageChart data={shown} days={days} />
      </section>

      <section className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold tracking-tight text-ink">Calls by API</h2>
        <p className="mt-0.5 text-xs text-muted">All time</p>

        {byApi.length === 0 ? (
          <p className="mt-6 text-sm text-muted">
            No traffic yet. Requests appear here once a key is used against the gateway.
          </p>
        ) : (
          <div className="mt-5 space-y-3">
            {byApi.map((a) => (
              <div key={a.name} className="flex items-center gap-3">
                <span className="w-36 shrink-0 truncate text-xs text-ink">{a.name}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-elevated">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.max(2, (a.calls / maxApi) * 100)}%`, background: a.color }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted">
                  {compact(a.calls)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
