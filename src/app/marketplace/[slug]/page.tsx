import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { apis, getApi } from "@/data/apis";
import { categoryBySlug } from "@/data/categories";
import ApiTabs from "@/components/ApiTabs";
import ApiCard, { Stars } from "@/components/ApiCard";
import { compact } from "@/lib/utils";

export function generateStaticParams() {
  return apis.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const api = getApi(slug);
  if (!api) return { title: "API not found" };
  return {
    title: api.name,
    description: api.tagline,
    openGraph: { title: `${api.name} | Zephiel API`, description: api.tagline },
  };
}

export default async function ApiDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const api = getApi(slug);
  if (!api) notFound();

  const cat = categoryBySlug(api.category);
  const related = apis.filter((a) => a.category === api.category && a.slug !== api.slug).slice(0, 3);
  const startsAt = api.plans.find((p) => p.price > 0)?.price ?? 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <nav className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <Link href="/marketplace" className="transition hover:text-ink">
          Marketplace
        </Link>
        <span aria-hidden>/</span>
        <Link href={`/categories/${api.category}`} className="transition hover:text-ink">
          {cat?.name}
        </Link>
        <span aria-hidden>/</span>
        <span className="text-ink">{api.name}</span>
      </nav>

      {/* Header */}
      <header className="mt-6 flex flex-col gap-6 rounded-3xl border border-line bg-surface p-6 sm:p-8 lg:flex-row lg:items-start">
        <span
          className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-xl font-bold text-white"
          style={{ background: `linear-gradient(135deg, ${api.color}, ${api.color}bb)` }}
        >
          {api.logo}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{api.name}</h1>
            {api.freeTier && (
              <span className="rounded-md bg-accent/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-accent">
                Free tier
              </span>
            )}
          </div>
          <p className="mt-2 text-[15px] leading-7 text-muted">{api.tagline}</p>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
            <Stars rating={api.rating} />
            <span>{api.reviews.toLocaleString()} reviews</span>
            <span className="hidden sm:inline text-line">|</span>
            <span>by {api.provider}</span>
            <span className="hidden sm:inline text-line">|</span>
            <span>{compact(api.subscribers)} subscribers</span>
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {api.tags.map((t) => (
              <span key={t} className="rounded-md bg-elevated px-2 py-1 text-[11px] font-medium text-muted">
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="w-full shrink-0 rounded-2xl border border-line bg-elevated p-5 lg:w-64">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">Starts at</p>
          <p className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-semibold tracking-tight text-ink">
              {startsAt === 0 ? "Free" : `$${startsAt}`}
            </span>
            {startsAt > 0 && <span className="text-sm text-muted">/mo</span>}
          </p>
          <button className="mt-4 w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700">
            Subscribe
          </button>
          <button className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-elevated">
            Try free
          </button>

          <dl className="mt-5 space-y-2.5 border-t border-line pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Latency</dt>
              <dd className="font-medium text-ink">{api.latency}ms</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Uptime</dt>
              <dd className="font-medium text-accent">{api.uptime}%</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Endpoints</dt>
              <dd className="font-medium text-ink">{api.endpoints.length}</dd>
            </div>
          </dl>
        </div>
      </header>

      <div className="mt-10">
        <ApiTabs api={api} />
      </div>

      {related.length > 0 && (
        <section className="mt-16 border-t border-line pt-10">
          <h2 className="text-lg font-semibold tracking-tight text-ink">Related APIs in {cat?.name}</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((a) => (
              <ApiCard key={a.slug} api={a} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
