import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Become a provider",
  description: "List your API on Zephiel and reach developers without building billing, keys, or docs infrastructure.",
};

const benefits = [
  { stat: "80,000+", label: "Developers browsing the marketplace" },
  { stat: "75 / 25", label: "Revenue split in your favour" },
  { stat: "0", label: "Billing infrastructure to build" },
];

const steps = [
  { n: "01", t: "Submit your OpenAPI spec", b: "We generate the listing, reference docs, and code samples from your spec automatically." },
  { n: "02", t: "Pass the review", b: "We load-test your endpoints, check error handling, and confirm your support response times." },
  { n: "03", t: "Set your tiers", b: "You define quotas and prices. We handle keys, metering, invoicing, tax, and dunning." },
  { n: "04", t: "Get paid monthly", b: "Revenue lands on net-30 terms with a full breakdown of calls by plan and customer." },
];

export default function ProvidersPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <header className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Distribution for your API, without the plumbing
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-8 text-muted">
          You built the API. We handle discovery, keys, metering, billing, tax, invoicing, and tier-one
          support — so you can spend your engineering time on the endpoints instead of on Stripe webhooks.
        </p>
      </header>

      <div className="mt-12 grid gap-4 sm:grid-cols-3">
        {benefits.map((b) => (
          <div key={b.label} className="rounded-2xl border border-line bg-surface p-6 text-center">
            <p className="text-3xl font-semibold tracking-tight text-ink">{b.stat}</p>
            <p className="mt-2 text-sm leading-6 text-muted">{b.label}</p>
          </div>
        ))}
      </div>

      <section className="mt-14">
        <h2 className="text-xl font-semibold tracking-tight text-ink">How listing works</h2>
        <div className="mt-6 space-y-3">
          {steps.map((s) => (
            <div key={s.n} className="flex gap-5 rounded-2xl border border-line bg-surface p-6">
              <span className="font-mono text-xs font-bold text-brand-600">{s.n}</span>
              <div>
                <h3 className="text-[15px] font-semibold tracking-tight text-ink">{s.t}</h3>
                <p className="mt-1.5 text-sm leading-6 text-muted">{s.b}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-14 rounded-3xl bg-gradient-to-br from-brand-700 to-brand-900 p-10 text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-white">Ready to list?</h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-brand-100">
          Send us your spec and a sandbox key. Most reviews finish inside five business days.
        </p>
        <Link
          href="/contact"
          className="mt-6 inline-block rounded-xl bg-white px-6 py-3 text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
        >
          Apply to list your API
        </Link>
      </div>
    </div>
  );
}
