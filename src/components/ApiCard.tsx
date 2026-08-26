import Link from "next/link";
import type { Api } from "@/data/apis";
import { categoryBySlug } from "@/data/categories";
import { compact } from "@/lib/utils";

export function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-1 text-amber-500" title={`${rating} out of 5`}>
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
        <path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.4l6.5-.9L12 2.6z" />
      </svg>
      <span className="text-xs font-semibold text-ink">{rating.toFixed(1)}</span>
    </span>
  );
}

export default function ApiCard({ api }: { api: Api }) {
  const cat = categoryBySlug(api.category);
  const entry = api.plans.find((p) => p.price > 0);

  return (
    <Link
      href={`/marketplace/${api.slug}`}
      className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-5 shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lift"
    >
      <div className="flex items-start gap-3.5">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[13px] font-bold text-white"
          style={{ background: `linear-gradient(135deg, ${api.color}, ${api.color}bb)` }}
        >
          {api.logo}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[15px] font-semibold tracking-tight text-ink">{api.name}</h3>
            {api.freeTier && (
              <span className="shrink-0 rounded-md bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                Free tier
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted">{api.provider}</p>
        </div>
        <Stars rating={api.rating} />
      </div>

      <p className="mt-3.5 flex-1 text-sm leading-6 text-muted line-clamp-2">{api.tagline}</p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {api.tags.slice(0, 3).map((t) => (
          <span key={t} className="rounded-md bg-elevated px-2 py-1 text-[11px] font-medium text-muted">
            {t}
          </span>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-line pt-3.5 text-xs text-muted">
        <span className="flex items-center gap-3">
          <span title="Subscribers">{compact(api.subscribers)} devs</span>
          <span className="text-line">|</span>
          <span title="Median latency">{api.latency}ms</span>
        </span>
        <span className="font-semibold text-ink">
          {!entry ? "Free" : `from $${entry.price}/${entry.unit ?? "mo"}`}
        </span>
      </div>

      <span className="sr-only">{cat?.name}</span>
    </Link>
  );
}
