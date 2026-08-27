"use client";

import Link from "next/link";
import { useState } from "react";
import type { Api } from "@/lib/types";
import ApiIcon from "@/components/ApiIcon";
import { cn } from "@/lib/utils";

/**
 * Use cases for the featured APIs, as an accordion.
 *
 * Each API keeps its own open item, so switching tabs returns you to where you
 * were rather than resetting. The panel shows the listing's real response
 * payload — for an API, that is the closest thing to a screenshot.
 */
export default function UseCaseExplorer({ apis }: { apis: Api[] }) {
  const [activeApi, setActiveApi] = useState(0);
  const [openByApi, setOpenByApi] = useState<Record<number, number>>({ 0: 0 });

  if (apis.length === 0) return null;

  const api = apis[activeApi];
  const open = openByApi[activeApi] ?? 0;

  return (
    <section className="border-y border-line bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">
            What people build
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Pick an API, see the problem it solves
          </h2>
        </div>

        {/* API selector */}
        <div
          role="tablist"
          aria-label="Featured APIs"
          className="scrollbar-none mt-10 flex justify-start gap-2 overflow-x-auto pb-1 sm:justify-center"
        >
          {apis.map((a, i) => (
            <button
              key={a.slug}
              role="tab"
              aria-selected={activeApi === i}
              onClick={() => setActiveApi(i)}
              className={cn(
                "flex shrink-0 items-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm font-medium transition",
                activeApi === i
                  ? "border-brand-500 bg-bg text-ink shadow-card"
                  : "border-line text-muted hover:border-brand-300 hover:text-ink"
              )}
            >
              <ApiIcon api={a} size="sm" className="h-7 w-7 rounded-md" />
              {a.name}
            </button>
          ))}
        </div>

        <div className="mt-10 grid items-start gap-8 lg:grid-cols-2 lg:gap-14">
          {/* Accordion */}
          <div className="space-y-2">
            {api.useCases.slice(0, 4).map((useCase, i) => {
              const isOpen = open === i;
              return (
                <div
                  key={useCase}
                  className={cn(
                    "overflow-hidden rounded-xl border transition",
                    isOpen ? "border-brand-400 bg-bg shadow-card" : "border-line hover:border-brand-300"
                  )}
                >
                  <button
                    onClick={() => setOpenByApi((s) => ({ ...s, [activeApi]: i }))}
                    aria-expanded={isOpen}
                    className="flex w-full items-center gap-3 px-5 py-4 text-left"
                  >
                    <span
                      className={cn(
                        "grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[11px] font-bold transition",
                        isOpen ? "bg-brand-600 text-white" : "bg-elevated text-muted"
                      )}
                    >
                      {i + 1}
                    </span>
                    <span className="flex-1 text-sm font-semibold text-ink">{useCase}</span>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden
                      className={cn(
                        "h-4 w-4 shrink-0 text-muted transition-transform",
                        isOpen && "rotate-90 text-brand-600"
                      )}
                    >
                      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 pl-[60px]">
                      <p className="text-sm leading-7 text-muted">
                        {api.tagline} Reach it through the same key and the same error envelope as
                        everything else on the platform.
                      </p>
                      <Link
                        href={`/marketplace/${api.slug}`}
                        className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 transition hover:text-brand-700"
                      >
                        Open {api.name}
                        <span aria-hidden>&rarr;</span>
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Response payload */}
          <div className="overflow-hidden rounded-2xl border border-line bg-[#0c1220] shadow-lift">
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
              <code className="ml-2 truncate font-mono text-[11px] text-slate-400">
                GET /v1/{api.slug}
                {api.endpoints[0]?.path ?? ""}
              </code>
            </div>
            <pre className="max-h-[340px] overflow-auto p-5 text-[12.5px] leading-6 text-slate-200">
              <code className="font-mono">{api.sampleResponse}</code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
