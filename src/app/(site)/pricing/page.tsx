import type { Metadata } from "next";
import Link from "next/link";
import PricingPlans from "@/components/PricingPlans";
import { countApis } from "@/server/catalog";
import type { Plan } from "@/lib/types";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Platform plans for Zephiel API — start free, scale to enterprise volume with one bill.",
};

/**
 * Platform plans, built cumulatively from one capability list.
 *
 * Each tier includes everything below it, which is what lets the cards show the
 * same rows with a tick or a cross. Four disjoint lists cannot be compared.
 */
const platformCapabilities = (n: number): { label: string; from: number }[] => [
  { label: `Access to all ${n} APIs`, from: 0 },
  { label: "One key across every API", from: 0 },
  { label: "JSON output format", from: 0 },
  { label: "HTTPS encryption", from: 0 },
  { label: "Community support", from: 0 },
  { label: "Basic usage analytics", from: 0 },
  { label: "Pooled calls across every API", from: 1 },
  { label: "5 project keys", from: 1 },
  { label: "Email support", from: 1 },
  { label: "Usage alerts at 80% and 100%", from: 1 },
  { label: "99.9% uptime SLA", from: 1 },
  { label: "Unlimited project keys", from: 2 },
  { label: "Team seats and roles", from: 2 },
  { label: "Priority support", from: 2 },
  { label: "Webhooks", from: 2 },
  { label: "90-day audit log", from: 2 },
  { label: "99.99% uptime SLA", from: 2 },
  { label: "Dedicated success manager", from: 3 },
  { label: "SSO / SAML and SCIM", from: 3 },
  { label: "Custom SLA, DPA, and BAA", from: 3 },
  { label: "Private regions available", from: 3 },
  { label: "Unlimited audit log", from: 3 },
  { label: "Invoiced annual billing", from: 3 },
];

const platformShapes = [
  { name: "Free", price: 0, requests: "100 calls per API/mo", rateLimit: "5 req/min" },
  { name: "Developer", price: 29, requests: "50,000 calls/mo pooled", rateLimit: "60 req/min" },
  { name: "Team", price: 149, requests: "500,000 calls/mo pooled", rateLimit: "600 req/min", popular: true },
  { name: "Enterprise", price: 0, requests: "Custom volume", rateLimit: "Custom" },
];

const buildPlans = (n: number): Plan[] => {
  const caps = platformCapabilities(n);
  return platformShapes.map((shape, i) => ({
    name: shape.name,
    price: shape.price,
    requests: shape.requests,
    rateLimit: shape.rateLimit,
    features: caps.filter((c) => c.from <= i).map((c) => c.label),
    ...(shape.popular ? { popular: true } : {}),
  }));
};

const buildComparison = (n: number): { feature: string; values: [string, string, string, string] }[] => [
  { feature: "APIs included", values: [`All ${n}`, `All ${n}`, `All ${n}`, `All ${n} + private`] },
  { feature: "Monthly calls", values: ["100 / API", "50,000", "500,000", "Custom"] },
  { feature: "Rate limit", values: ["5/min", "60/min", "600/min", "Custom"] },
  { feature: "Project keys", values: ["1", "5", "Unlimited", "Unlimited"] },
  { feature: "Team seats", values: ["1", "3", "Unlimited", "Unlimited"] },
  { feature: "Support", values: ["Community", "Email", "Priority", "Dedicated"] },
  { feature: "Uptime SLA", values: ["—", "99.9%", "99.99%", "Custom"] },
  { feature: "Webhooks", values: ["—", "—", "Yes", "Yes"] },
  { feature: "SSO / SAML", values: ["—", "—", "—", "Yes"] },
  { feature: "Audit log", values: ["—", "—", "90 days", "Unlimited"] },
];

const faqs = [
  {
    q: "What counts as a call?",
    a: "One successful HTTP request to any endpoint. Requests that return 4xx validation errors are not billed, and cached responses within a 60-second window count once.",
  },
  {
    q: "What happens when I exceed my quota?",
    a: "We do not hard-block your traffic. Overage is billed at the plan's per-1,000-call rate and you receive alerts at 80% and 100% of quota so nothing is a surprise.",
  },
  {
    q: "Can I subscribe to a single API instead of a platform plan?",
    a: "Yes. Every listing has its own tiers on its detail page. Platform plans pool calls across all APIs, which is usually cheaper once you use three or more.",
  },
  {
    q: "How is the Multistore API billed?",
    a: "Multistore is priced per connected storefront — $50 per store, per month — rather than per call, because its cost scales with stores rather than traffic. It is billed alongside your platform plan, not out of your pooled calls, and is prorated daily when you connect or disconnect a store.",
  },
  {
    q: "Do you offer annual billing?",
    a: "Annual billing saves two months on Developer and Team. Enterprise agreements are invoiced annually by default.",
  },
  {
    q: "How do I cancel?",
    a: "From the dashboard, in one click. Your plan stays active until the end of the current billing period and then drops to Free.",
  },
];

export const revalidate = 60;

export default async function PricingPage() {
  const apiCount = await countApis();
  const platformPlans = buildPlans(apiCount);
  const comparison = buildComparison(apiCount);

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <header className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Pricing that pools across every API
        </h1>
        <p className="mt-4 text-[15px] leading-7 text-muted">
          One plan covers all {apiCount} APIs. Buy calls once, spend them wherever your product needs them, and
          never negotiate a separate contract again.
        </p>
      </header>

      <div className="mt-12">
        <PricingPlans
          plans={platformPlans}
          hrefs={{ Free: "/signup", Developer: "/signup", Team: "/signup" }}
        />
      </div>

      <section className="mt-20">
        <h2 className="text-xl font-semibold tracking-tight text-ink">Compare plans</h2>
        <div className="mt-6 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[640px] border-collapse text-sm">
              <caption className="sr-only">Feature comparison across platform plans</caption>
            <thead>
              <tr className="bg-elevated">
                <th scope="col" className="px-5 py-3.5 text-left font-semibold text-ink">Feature</th>
                {platformPlans.map((p) => (
                  <th scope="col" key={p.name} className="px-5 py-3.5 text-left font-semibold text-ink">
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparison.map((row, i) => (
                <tr key={row.feature} className={i % 2 ? "bg-elevated/40" : "bg-surface"}>
                  <td className="px-5 py-3.5 font-medium text-ink">{row.feature}</td>
                  {row.values.map((v, j) => (
                    <td key={j} className="px-5 py-3.5 text-muted">
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-20">
        <h2 className="text-xl font-semibold tracking-tight text-ink">Frequently asked</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {faqs.map((f) => (
            <details key={f.q} className="group rounded-2xl border border-line bg-surface p-5">
              <summary className="cursor-pointer list-none text-sm font-semibold text-ink marker:hidden">
                <span className="flex items-center justify-between gap-4">
                  {f.q}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0 text-muted transition group-open:rotate-45">
                    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                  </svg>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-6 text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mt-20 rounded-3xl border border-line bg-surface p-10 text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">Need something custom?</h2>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-muted">
          Volume commitments, private deployments, on-prem data residency, and bespoke SLAs are all on the
          table. Tell us your traffic profile and we will build a plan around it.
        </p>
        <Link
          href="/contact"
          className="mt-6 inline-block rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          Talk to sales
        </Link>
      </section>
    </div>
  );
}
