import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About",
  description: "Why Zephiel exists, what we are building, and the decade behind it.",
};

const values = [
  {
    title: "One integration surface",
    body: "Every API on Zephiel shares a base URL, an auth header, an error envelope, and a rate-limit contract. Learn it once, use it everywhere.",
  },
  {
    title: "Free tiers, not free trials",
    body: "A trial that expires is a deadline. A free tier that never expires lets you prototype on your own schedule and upgrade when traffic justifies it.",
  },
  {
    title: "Honest limits",
    body: "We publish real latency percentiles and real uptime per API, including the bad months. Vendor pages that only show green are not telling you anything.",
  },
  {
    title: "No procurement theatre",
    body: "Adding a vendor should take a checkout form, not a quarter. One contract with us covers every provider on the platform.",
  },
];

const milestones = [
  { year: "2015", body: "Founded after counting seven weeks of procurement to add one API. Four providers, one gateway, one region." },
  { year: "2016", body: "Every endpoint moved to HTTPS the month Let's Encrypt left beta. Per-endpoint pricing rejected for a single flat unit." },
  { year: "2017", body: "Gateway moved to HTTP/2. The status page was rebuilt to generate itself, so a bad day can no longer be edited out." },
  { year: "2018", body: "GDPR tooling shipped ahead of enforcement: export, real deletion, retention limits. TLS 1.3 the month the RFC landed." },
  { year: "2019", body: "Keys gained expiry, age, and last-used tracking, so rotation stopped being a task with no deadline." },
  { year: "2020", body: "Idempotency keys made mandatory on every write. Five years of free tiers that have never expired." },
  { year: "2021", body: "Ten days of dependency archaeology during Log4Shell. Every deployed artefact has carried a bill of materials since." },
  { year: "2022", body: "Per-store billing introduced for multi-storefront retailers, along with per-store keys and usage." },
  { year: "2023", body: "A listing policy for generative APIs: labelled, measured the same way as everything else, never sold as a drop-in upgrade." },
  { year: "2024", body: "The gateway was replaced over fourteen months with no maintenance window and ninety seconds of customer-visible impact." },
  { year: "2025", body: "Ten years. The Multistore API became the fastest growing listing on the platform." },
  { year: "2026", body: "38 APIs, one key, one invoice, and the same latency percentiles published whether or not they flatter us." },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
        We built the marketplace we kept wishing existed
      </h1>
      <p className="mt-5 text-[15px] leading-8 text-muted">
        Most teams do not have an API problem. They have an API <em>sprawl</em> problem — six vendors, six
        dashboards, six invoices, six sets of credentials rotting in six different secret stores, and no
        single place to see what any of it costs or whether it is up.
      </p>
      <p className="mt-4 text-[15px] leading-8 text-muted">
        Zephiel collapses that into one account. We vet each provider on documentation quality, latency
        under load, and how fast a human answers a support ticket. Then we put them behind a single key
        and a single bill, and publish what we measure.
      </p>
      <p className="mt-4 text-[15px] leading-8 text-muted">
        We are headquartered in Houston, Texas, with a regional office in Cape Town covering customers
        across Africa &mdash; which is also why the platform settles in more than one currency and
        publishes latency per region rather than one global median.
      </p>
      <p className="mt-4 text-[15px] leading-8 text-muted">
        We have been doing this since 2015 &mdash; long enough to have been wrong in public a few times
        and to have written most of it down. The{" "}
        <Link href="/blog" className="font-medium text-brand-600 hover:underline">
          blog archive
        </Link>{" "}
        goes back to the first ten providers.
      </p>

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {values.map((v) => (
          <div key={v.title} className="rounded-2xl border border-line bg-surface p-6">
            <h2 className="text-[15px] font-semibold tracking-tight text-ink">{v.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{v.body}</p>
          </div>
        ))}
      </div>

      <section className="mt-16">
        <h2 className="text-xl font-semibold tracking-tight text-ink">A decade, briefly</h2>
        <ol className="mt-6 space-y-0">
          {milestones.map((m, i) => (
            <li key={m.year} className="relative flex gap-5 pb-7 last:pb-0">
              <div className="flex flex-col items-center">
                <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-600" />
                {i < milestones.length - 1 && <span className="mt-1 w-px flex-1 bg-line" />}
              </div>
              <div className="-mt-0.5 min-w-0">
                <p className="text-sm font-semibold tabular-nums tracking-tight text-ink">{m.year}</p>
                <p className="mt-1 text-sm leading-7 text-muted">{m.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-16 rounded-2xl border border-line bg-surface p-8 text-center">
        <p className="text-sm leading-7 text-muted">
          Building an API you think belongs here? We onboard new providers every month.
        </p>
        <Link
          href="/providers"
          className="mt-5 inline-block rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          Become a provider
        </Link>
      </div>
    </div>
  );
}
