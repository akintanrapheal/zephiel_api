import Link from "next/link";
import { countApis, getApis, getCategories, getCategoryCounts, getFeaturedApis } from "@/server/catalog";
import ApiCard from "@/components/ApiCard";
import CodeSamples from "@/components/CodeSamples";
import BrandMarquee from "@/components/BrandMarks";
import Spotlights from "@/components/home/Spotlights";
import Audience from "@/components/home/Audience";
import Testimonials from "@/components/home/Testimonials";
import UseCaseExplorer from "@/components/home/UseCaseExplorer";
import Platform from "@/components/home/Platform";
import LatestPosts from "@/components/home/LatestPosts";
import { getPosts } from "@/server/posts";

export const revalidate = 60;

const stats = (apiCount: number) => [
  { value: String(apiCount), label: "Production APIs" },
  { value: "3.1M", label: "Calls served daily" },
  { value: "99.98%", label: "Platform uptime" },
  { value: "68ms", label: "Median latency" },
];

const steps = (apiCount: number) => [
  {
    n: "01",
    title: "Find the right API",
    body: `Filter ${apiCount} vetted APIs by category, latency, rating, or free tier. Every listing shows real response shapes before you commit.`,
  },
  {
    n: "02",
    title: "Grab one key",
    body: "A single Zephiel key authenticates every API on the platform. No separate accounts, no separate invoices, no procurement queue.",
  },
  {
    n: "03",
    title: "Ship and scale",
    body: "Start on a free tier, watch usage in the dashboard, and move to a paid plan the moment traffic justifies it.",
  },
];

export default async function Home() {
  const [featured, all, categories, counts, apiCount] = await Promise.all([
    getFeaturedApis(),
    getApis(),
    getCategories(),
    getCategoryCounts(),
    countApis(),
  ]);

  const posts = await getPosts({ limit: 3 });
  const trending = all.slice(0, 6);
  const statTiles = stats(apiCount);
  const stepList = steps(apiCount);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-bg" aria-hidden />
        <div className="absolute inset-x-0 top-0 h-[520px] glow" aria-hidden />

        <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-20 sm:px-6 lg:px-8 lg:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <Link
              href="/marketplace"
              className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-3.5 py-1.5 text-xs font-medium text-muted backdrop-blur transition hover:text-ink"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              {apiCount} APIs live — every one with a free tier
              <span aria-hidden>&rarr;</span>
            </Link>

            <h1 className="mt-6 animate-fade-up text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-6xl">
              Every API your product needs,
              <span className="bg-gradient-to-r from-brand-500 to-brand-700 bg-clip-text text-transparent"> behind one key</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-[17px] leading-8 text-muted">
              Zephiel is a marketplace of production-grade REST APIs — currency, geolocation, AI, weather,
              documents, and more. One account, one bill, one dashboard, and a free tier on every listing.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/marketplace"
                className="w-full rounded-xl bg-brand-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lift transition hover:bg-brand-700 sm:w-auto"
              >
                Browse the marketplace
              </Link>
              <Link
                href="/docs"
                className="w-full rounded-xl border border-line bg-surface px-6 py-3.5 text-sm font-semibold text-ink transition hover:bg-elevated sm:w-auto"
              >
                Read the docs
              </Link>
            </div>

            <p className="mt-4 text-xs text-muted">No credit card required &middot; 100 free calls per API per month</p>
          </div>

          <div className="mx-auto mt-16 max-w-3xl">
            <CodeSamples slug="exchange-rates-data" endpoint="/latest?base=USD&symbols=EUR,GBP,NGN" />
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-12 sm:px-6 lg:grid-cols-4 lg:px-8">
          {statTiles.map((s) => (
            <div key={s.label}>
              <p className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{s.value}</p>
              <p className="mt-1.5 text-sm text-muted">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <BrandMarquee label="Trusted by engineering teams at" />

      {/* Featured */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Featured APIs</h2>
            <p className="mt-2 text-sm text-muted">Hand-picked for reliability, documentation quality, and support responsiveness.</p>
          </div>
          <Link href="/marketplace" className="text-sm font-semibold text-brand-600 transition hover:text-brand-700">
            View all {apiCount} &rarr;
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((api) => (
            <ApiCard key={api.slug} api={api} />
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Browse by category</h2>
          <p className="mt-2 text-sm text-muted">
            {categories.length} categories covering the integrations most products need on day one.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((c) => {
              const count = counts[c.slug] ?? 0;
              return (
                <Link
                  key={c.slug}
                  href={`/categories/${c.slug}`}
                  className="group rounded-2xl border border-line bg-bg p-5 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/10 text-brand-600">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5">
                      <path d={c.icon} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <h3 className="mt-4 text-[15px] font-semibold tracking-tight text-ink">{c.name}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-muted">{c.blurb}</p>
                  <p className="mt-3 text-xs font-medium text-muted">
                    {count} {count === 1 ? "API" : "APIs"}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">From search to production in minutes</h2>
          <p className="mt-3 text-sm leading-7 text-muted">
            The slowest part of adding an API is rarely the code. Zephiel removes the account creation, the
            billing negotiation, and the key sprawl.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {stepList.map((s) => (
            <div key={s.n} className="relative rounded-2xl border border-line bg-surface p-6">
              <span className="font-mono text-xs font-bold text-brand-600">{s.n}</span>
              <h3 className="mt-3 text-[15px] font-semibold tracking-tight text-ink">{s.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <UseCaseExplorer apis={featured} />

      <Spotlights apis={featured.slice(0, 3)} />

      <Platform />

      <Audience />

      <Testimonials />

      <LatestPosts posts={posts} />

      {/* Trending */}
      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Trending this month</h2>
          <p className="mt-2 text-sm text-muted">Ranked by new subscribers across the platform.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trending.map((api) => (
              <ApiCard key={api.slug} api={api} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 px-6 py-16 text-center sm:px-16">
          <div className="absolute inset-0 opacity-20" aria-hidden
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(255,255,255,.4) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.4) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
          <div className="relative">
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Start building with your free key
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-7 text-brand-100">
              100 free calls per API every month, forever. Upgrade only when your traffic does.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
              >
                Create free account
              </Link>
              <Link
                href="/pricing"
                className="rounded-xl border border-white/25 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Compare plans
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
