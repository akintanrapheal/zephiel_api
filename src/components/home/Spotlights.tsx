import Link from "next/link";
import type { Api } from "@/lib/types";
import ApiIcon from "@/components/ApiIcon";
import { compact } from "@/lib/utils";

/**
 * Alternating deep-dives for the featured listings — the reading rhythm changes
 * side each row, which keeps a long page from feeling like one list.
 */
export default function Spotlights({ apis }: { apis: Api[] }) {
  if (apis.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">
          A closer look
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          What teams build with them
        </h2>
      </div>

      <div className="mt-14 space-y-16 lg:space-y-24">
        {apis.map((api, i) => (
          <div
            key={api.slug}
            className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16"
          >
            <div className={i % 2 === 1 ? "lg:order-2" : undefined}>
              <div className="flex items-center gap-3">
                <ApiIcon api={api} size="md" />
                <div>
                  <h3 className="text-xl font-semibold tracking-tight text-ink">{api.name}</h3>
                  <p className="text-xs text-muted">{api.provider}</p>
                </div>
              </div>

              <p className="mt-5 text-[15px] leading-8 text-muted">{api.tagline}</p>

              <ul className="mt-6 space-y-3">
                {api.useCases.slice(0, 4).map((u) => (
                  <li key={u} className="flex items-start gap-3 text-sm text-ink">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      aria-hidden
                      className="mt-1 h-3.5 w-3.5 shrink-0 text-accent"
                    >
                      <path d="M4 12.5l5 5L20 6.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {u}
                  </li>
                ))}
              </ul>

              <div className="mt-7 flex flex-wrap items-center gap-4">
                <Link
                  href={`/marketplace/${api.slug}`}
                  className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
                >
                  View {api.name}
                </Link>
                <span className="text-xs text-muted">
                  {compact(api.subscribers)} developers &middot; {api.latency}ms median
                </span>
              </div>
            </div>

            {/* A rendered response is the most honest "screenshot" for an API. */}
            <div className={i % 2 === 1 ? "lg:order-1" : undefined}>
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
                <pre className="max-h-[320px] overflow-auto p-5 text-[12.5px] leading-6 text-slate-200">
                  <code className="font-mono">{api.sampleResponse}</code>
                </pre>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
