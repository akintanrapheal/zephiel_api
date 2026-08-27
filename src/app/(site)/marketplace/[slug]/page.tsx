import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getApiBySlug, getApisByCategory, getCategoryBySlug } from "@/server/catalog";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import ApiTabs from "@/components/ApiTabs";
import ApiCard, { Stars } from "@/components/ApiCard";
import ApiIcon from "@/components/ApiIcon";
import { compact } from "@/lib/utils";

export const revalidate = 60;

const errors: Record<string, string> = {
  "missing-plan": "Choose a plan before subscribing.",
  "unknown-plan": "That plan is no longer available.",
  "payments-unconfigured":
    "Paid checkout is unavailable — this deployment has no Paystack key configured. Free plans still work.",
  "payment-init-failed": "Could not start the payment. Please try again.",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const api = await getApiBySlug(slug);
  if (!api) return { title: "API not found" };
  return {
    title: api.name,
    description: api.tagline,
    openGraph: { title: `${api.name} | Zephiel API`, description: api.tagline },
  };
}

export default async function ApiDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;

  const api = await getApiBySlug(slug);
  if (!api) notFound();

  const [cat, siblings, user] = await Promise.all([
    getCategoryBySlug(api.category),
    getApisByCategory(api.category),
    getCurrentUser(),
  ]);

  // Which plan, if any, this visitor is already on.
  let currentPlan: string | null = null;
  if (user) {
    const [row] = await sql<{ name: string }[]>`
      SELECT p.name FROM subscriptions s
      JOIN plans p ON p.id = s.plan_id
      WHERE s.user_id = ${user.id} AND s.api_id = ${api.id!} AND s.status = 'active'
      LIMIT 1
    `;
    currentPlan = row?.name ?? null;
  }

  const related = siblings.filter((a) => a.slug !== api.slug).slice(0, 3);
  const entry = api.plans.find((p) => p.price > 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <nav className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <Link href="/marketplace" className="transition hover:text-ink">
          Marketplace
        </Link>
        <span aria-hidden>/</span>
        <Link href={`/categories/${api.category}`} className="transition hover:text-ink">
          {cat?.name ?? "Uncategorised"}
        </Link>
        <span aria-hidden>/</span>
        <span className="text-ink">{api.name}</span>
      </nav>

      {error && errors[error] && (
        <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-muted">
          {errors[error]}
        </p>
      )}

      <header className="mt-6 flex flex-col gap-6 rounded-3xl border border-line bg-surface p-6 sm:p-8 lg:flex-row lg:items-start">
        <ApiIcon api={api} size="lg" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{api.name}</h1>
            {api.freeTier && (
              <span className="rounded-md bg-accent/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-accent">
                Free tier
              </span>
            )}
            {currentPlan && (
              <span className="rounded-md bg-brand-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-600">
                Subscribed &middot; {currentPlan}
              </span>
            )}
          </div>
          <p className="mt-2 text-[15px] leading-7 text-muted">{api.tagline}</p>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
            <Stars rating={api.rating} />
            <span>{api.reviews.toLocaleString()} reviews</span>
            <span className="hidden text-line sm:inline">|</span>
            <span>by {api.provider}</span>
            <span className="hidden text-line sm:inline">|</span>
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
              {!entry ? "Free" : `$${entry.price}`}
            </span>
            {entry && <span className="text-sm text-muted">{entry.unit ? `/${entry.unit}/mo` : "/mo"}</span>}
          </p>

          {api.plans.length > 0 ? (
            <a
              href="#plans"
              className="mt-4 block rounded-xl bg-brand-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              {currentPlan ? "Change plan" : "Choose a plan"}
            </a>
          ) : (
            <p className="mt-4 rounded-xl bg-elevated px-4 py-2.5 text-center text-xs text-muted">
              Not yet available to subscribe
            </p>
          )}
          {!user && (
            <p className="mt-2 text-center text-xs text-muted">
              <Link href="/signup" className="text-brand-600 hover:underline">
                Create a free account
              </Link>{" "}
              to subscribe.
            </p>
          )}

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

      <div className="mt-10 scroll-mt-24" id="plans">
        <ApiTabs api={api} currentPlan={currentPlan} />
      </div>

      {related.length > 0 && (
        <section className="mt-16 border-t border-line pt-10">
          <h2 className="text-lg font-semibold tracking-tight text-ink">
            Related APIs in {cat?.name ?? "this category"}
          </h2>
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
