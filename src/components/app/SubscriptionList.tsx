"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Subscription } from "@/lib/types";
import ApiIcon from "@/components/ApiIcon";
import { cancelSubscription } from "@/server/actions/subscribe";
import { cn } from "@/lib/utils";

type Filter = "all" | "active" | "attention";

const statusStyles: Record<string, string> = {
  active: "bg-accent/10 text-accent",
  pending: "bg-amber-500/10 text-amber-600",
  cancelled: "bg-elevated text-muted",
  expired: "bg-rose-500/10 text-rose-600",
};

function daysLeft(end: Date | null) {
  if (!end) return null;
  return Math.ceil((new Date(end).getTime() - Date.now()) / 86_400_000);
}

export default function SubscriptionList({ subs }: { subs: Subscription[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return subs.filter((s) => {
      const pct = s.quota === 0 ? 0 : (s.used / s.quota) * 100;
      const renews = daysLeft(s.currentPeriodEnd);
      const needsAttention = pct >= 80 || s.status !== "active" || (renews !== null && renews <= 7);

      if (filter === "active" && s.status !== "active") return false;
      if (filter === "attention" && !needsAttention) return false;
      if (!q) return true;
      return s.apiName.toLowerCase().includes(q) || s.planName.toLowerCase().includes(q);
    });
  }, [subs, query, filter]);

  if (subs.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line px-5 py-14 text-center">
        <p className="text-sm font-medium text-ink">No subscriptions yet</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
          Every API has a free tier — subscribe to one and your key can call it straight away.
        </p>
        <Link
          href="/marketplace"
          className="mt-5 inline-block rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          Browse the marketplace
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
          </svg>
          <label htmlFor="sub-search" className="sr-only">
            Filter your subscriptions
          </label>
          <input
            id="sub-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter subscriptions..."
            className="w-full rounded-xl border border-line bg-surface py-2.5 pl-10 pr-4 text-sm text-ink outline-none transition placeholder:text-muted focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
          />
        </div>

        <div role="group" aria-label="Filter by status" className="flex gap-1 rounded-xl border border-line bg-surface p-1">
          {([
            ["all", "All"],
            ["active", "Active"],
            ["attention", "Needs attention"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                filter === value ? "bg-brand-600 text-white" : "text-muted hover:text-ink"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-4 text-xs text-muted" aria-live="polite">
        Showing {shown.length} of {subs.length}
      </p>

      <div className="mt-3 space-y-3">
        {shown.length === 0 && (
          <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
            Nothing matches that filter.
          </p>
        )}

        {shown.map((s) => {
          const pct = s.quota === 0 ? 0 : Math.min(100, Math.round((s.used / s.quota) * 100));
          const hot = pct >= 80;
          const renews = daysLeft(s.currentPeriodEnd);
          const monthly = s.planPrice * (s.planUnit ? s.units : 1);

          return (
            <div
              key={s.id}
              className="rounded-2xl border border-line bg-surface p-5 transition hover:border-brand-300 hover:shadow-card"
            >
              <div className="flex flex-wrap items-center gap-3">
                <ApiIcon
                  api={{ logo: s.apiLogo, color: s.apiColor, icon: s.apiIcon }}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/marketplace/${s.apiSlug}`}
                    className="truncate text-sm font-semibold text-ink hover:text-brand-600"
                  >
                    {s.apiName}
                  </Link>
                  <p className="truncate text-xs text-muted">
                    {s.planName}
                    {s.planUnit && ` · ${s.units} ${s.planUnit}${s.units === 1 ? "" : "s"}`}
                  </p>
                </div>

                <span
                  className={cn(
                    "shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase",
                    statusStyles[s.status] ?? "bg-elevated text-muted"
                  )}
                >
                  {s.status}
                </span>

                <p className="shrink-0 text-sm font-semibold text-ink">
                  {monthly === 0 ? "Free" : `$${monthly.toLocaleString()}/mo`}
                </p>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-elevated">
                  <div
                    className={cn("h-full rounded-full transition-all", hot ? "bg-amber-500" : "bg-brand-500")}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="shrink-0 text-xs tabular-nums text-muted">
                  {s.used.toLocaleString()} / {s.quota.toLocaleString()}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
                {s.currentPeriodEnd && (
                  <span className={renews !== null && renews <= 7 ? "font-medium text-amber-600" : undefined}>
                    {renews !== null && renews < 0
                      ? "Expired"
                      : `Renews ${new Date(s.currentPeriodEnd).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}`}
                    {renews !== null && renews >= 0 && ` · ${renews} day${renews === 1 ? "" : "s"} left`}
                  </span>
                )}

                <Link href="/dashboard/billing" className="font-medium text-brand-600 hover:underline">
                  Change plan
                </Link>

                {s.status === "active" && (
                  <form action={cancelSubscription}>
                    <input type="hidden" name="id" value={s.id} />
                    <button className="font-medium transition hover:text-rose-600">Cancel</button>
                  </form>
                )}
              </div>

              {hot && s.status === "active" && (
                <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-600">
                  {pct}% of quota used — calls start failing at 100%.{" "}
                  <Link href="/dashboard/billing" className="font-semibold underline">
                    Upgrade for more
                  </Link>
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
