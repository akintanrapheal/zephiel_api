"use client";

import { useState } from "react";
import type { Api } from "@/lib/types";
import CodeSamples from "./CodeSamples";
import PlanCard from "./PlanCard";
import { cn } from "@/lib/utils";
import ReviewForm from "./ReviewForm";
import type { Review, ReviewSummary } from "@/server/reviews";

const tabs = ["Overview", "Endpoints", "Pricing", "Reviews"] as const;
type Tab = (typeof tabs)[number];

const methodStyles: Record<string, string> = {
  GET: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  POST: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  PUT: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  DELETE: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

export default function ApiTabs({
  api,
  currentPlan,
  reviews,
  summary,
  canReview,
  ownReview,
}: {
  api: Api;
  currentPlan?: string | null;
  reviews: Review[];
  summary: ReviewSummary;
  canReview: boolean;
  ownReview: { rating: number; title: string; body: string; role: string } | null;
}) {
  const [tab, setTab] = useState<Tab>("Overview");
  const perUnit = api.plans.find((p) => p.unit)?.unit;

  return (
    <div>
      <div className="scrollbar-none flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition",
              tab === t
                ? "border-brand-600 text-ink"
                : "border-transparent text-muted hover:text-ink"
            )}
          >
            {t}
            {t === "Reviews" && (
              <span className="ml-1.5 text-xs text-muted">{summary.count.toLocaleString()}</span>
            )}
          </button>
        ))}
      </div>

      <div className="pt-8">
        <div hidden={tab !== "Overview"}>
          <div className="space-y-8">
            <section>
              <h2 className="text-lg font-semibold tracking-tight text-ink">About this API</h2>
              <p className="mt-3 text-[15px] leading-7 text-muted">{api.description}</p>
            </section>

            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-ink">Common use cases</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {api.useCases.map((u) => (
                  <div key={u} className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 h-4 w-4 shrink-0 text-accent">
                      <path d="M4 12.5l5 5L20 6.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="text-sm text-ink">{u}</span>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-ink">Quickstart</h3>
              <p className="mt-2 text-sm text-muted">
                Every Zephiel API uses the same base URL, the same key header, and the same error envelope.
              </p>
              <div className="mt-4">
                <CodeSamples
                  slug={api.slug}
                  endpoint={(api.endpoints[0]?.path ?? "/").replace(/\{[^}]+\}/g, "8.8.8.8")}
                />
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-ink">Example response</h3>
              <pre className="mt-4 overflow-x-auto rounded-2xl border border-line bg-elevated p-5 text-[13px] leading-6">
                <code className="font-mono text-ink">{api.sampleResponse}</code>
              </pre>
            </section>
          </div>
        </div>

        <div hidden={tab !== "Endpoints"}>
          <div className="space-y-3">
            {api.endpoints.length === 0 && (
              <p className="rounded-xl border border-dashed border-line px-4 py-10 text-center text-sm text-muted">
                No endpoints have been published for this API yet.
              </p>
            )}
            {api.endpoints.map((e) => (
              <div
                key={e.method + e.path}
                className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4 sm:flex-row sm:items-center sm:gap-4"
              >
                <span
                  className={cn(
                    "w-fit shrink-0 rounded-md px-2 py-1 text-[11px] font-bold tracking-wide",
                    methodStyles[e.method]
                  )}
                >
                  {e.method}
                </span>
                <code className="shrink-0 font-mono text-sm text-ink">
                  <span className="text-muted">/v1/{api.slug}</span>
                  {e.path}
                </code>
                <span className="text-sm text-muted sm:ml-auto sm:text-right">{e.summary}</span>
              </div>
            ))}
            <p className="pt-2 text-sm text-muted">
              All endpoints return JSON and accept the <code className="rounded bg-elevated px-1.5 py-0.5 font-mono text-xs">X-Zephiel-Key</code> header.
              Rate limits are enforced per plan and reported in <code className="rounded bg-elevated px-1.5 py-0.5 font-mono text-xs">X-RateLimit-Remaining</code>.
            </p>
          </div>
        </div>

        <div hidden={tab !== "Pricing"}>
          <div>
            <p className="text-sm text-muted">
              {perUnit
                ? `Plans are billed monthly per connected ${perUnit}, counted daily and prorated, so adding or removing one mid-month only changes that month's total by the days it was active.`
                : "Plans are billed monthly and can be changed or cancelled at any time. Overage is charged per 1,000 requests rather than hard-blocking your traffic."}
            </p>
            {api.plans.length === 0 && (
              <p className="mt-6 rounded-xl border border-dashed border-line px-4 py-10 text-center text-sm text-muted">
                No plans have been published for this API yet — it cannot be subscribed to.
              </p>
            )}
            <div
              className={cn(
                "mt-6 grid gap-4",
                api.plans.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2 xl:grid-cols-4"
              )}
            >
              {api.plans.map((p) => (
                <PlanCard key={p.name} plan={p} apiSlug={api.slug} currentPlan={currentPlan} />
              ))}
            </div>
          </div>
        </div>

        <div hidden={tab !== "Reviews"}>
          <div className="space-y-4">
            {summary.count === 0 ? (
              <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-sm text-muted">
                No reviews yet.
                {canReview ? " Be the first." : " Only customers who have subscribed can review."}
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-6 rounded-2xl border border-line bg-surface p-6">
                <div>
                  <p className="text-4xl font-semibold tracking-tight text-ink">
                    {summary.average.toFixed(1)}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {summary.count.toLocaleString()} review{summary.count === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex-1 space-y-1.5">
                  {summary.distribution.map((d) => (
                    <div key={d.stars} className="flex items-center gap-3 text-xs text-muted">
                      <span className="w-3">{d.stars}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-elevated">
                        <div
                          className="h-full rounded-full bg-amber-400"
                          style={{ width: `${d.percent}%` }}
                        />
                      </div>
                      <span className="w-8 text-right tabular-nums">{d.percent}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {canReview && <ReviewForm apiId={api.id!} apiSlug={api.slug} existing={ownReview} />}

            {reviews.map((r) => (
              <div key={r.id} className="rounded-2xl border border-line bg-surface p-6">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-elevated text-xs font-semibold text-ink">
                    {(r.authorName || "?").slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {r.authorName || "Customer"}
                    </p>
                    {r.role && <p className="truncate text-xs text-muted">{r.role}</p>}
                  </div>
                  <span className="ml-auto flex gap-0.5 text-amber-500" title={`${r.rating} out of 5`}>
                    {Array.from({ length: r.rating }).map((_, i) => (
                      <svg key={i} viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-3.5 w-3.5">
                        <path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.4l6.5-.9L12 2.6z" />
                      </svg>
                    ))}
                  </span>
                </div>
                {r.title && <p className="mt-3 text-sm font-semibold text-ink">{r.title}</p>}
                <p className="mt-1.5 text-sm leading-6 text-muted">{r.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
