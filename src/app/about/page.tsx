import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About",
  description: "Why Zephiel exists and what we are building.",
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

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {values.map((v) => (
          <div key={v.title} className="rounded-2xl border border-line bg-surface p-6">
            <h2 className="text-[15px] font-semibold tracking-tight text-ink">{v.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{v.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-12 rounded-2xl border border-line bg-surface p-8 text-center">
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
