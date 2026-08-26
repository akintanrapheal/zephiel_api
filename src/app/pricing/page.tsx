import type { Metadata } from "next";
import Link from "next/link";
import PlanCard from "@/components/PlanCard";
import type { Plan } from "@/data/apis";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Platform plans for Zephiel API — start free, scale to enterprise volume with one bill.",
};

const platformPlans: Plan[] = [
  {
    name: "Free",
    price: 0,
    requests: "100 calls per API/mo",
    rateLimit: "5 req/min",
    features: [
      "Access to all 24 APIs",
      "1 project key",
      "Community support",
      "Basic usage analytics",
    ],
  },
  {
    name: "Developer",
    price: 29,
    requests: "50,000 calls/mo pooled",
    rateLimit: "60 req/min",
    features: [
      "Pooled across every API",
      "5 project keys",
      "Email support",
      "99.9% uptime SLA",
      "Usage alerts",
    ],
  },
  {
    name: "Team",
    price: 149,
    requests: "500,000 calls/mo pooled",
    rateLimit: "600 req/min",
    features: [
      "Unlimited project keys",
      "Team seats & roles",
      "Priority support",
      "99.99% uptime SLA",
      "Webhooks & audit log",
    ],
    popular: true,
  },
  {
    name: "Enterprise",
    price: 0,
    requests: "Custom volume",
    rateLimit: "Custom",
    features: [
      "Dedicated success manager",
      "SSO / SAML & SCIM",
      "Custom SLA, DPA, and BAA",
      "Private regions available",
      "Invoiced annual billing",
    ],
  },
];

const comparison: { feature: string; values: [string, string, string, string] }[] = [
  { feature: "APIs included", values: ["All 24", "All 24", "All 24", "All 24 + private"] },
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
    q: "Do you offer annual billing?",
    a: "Annual billing saves two months on Developer and Team. Enterprise agreements are invoiced annually by default.",
  },
  {
    q: "How do I cancel?",
    a: "From the dashboard, in one click. Your plan stays active until the end of the current billing period and then drops to Free.",
  },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <header className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Pricing that pools across every API
        </h1>
        <p className="mt-4 text-[15px] leading-7 text-muted">
          One plan covers all 24 APIs. Buy calls once, spend them wherever your product needs them, and
          never negotiate a separate contract again.
        </p>
      </header>

      <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {platformPlans.map((p) => (
          <PlanCard key={p.name} plan={p} />
        ))}
      </div>

      <section className="mt-20">
        <h2 className="text-xl font-semibold tracking-tight text-ink">Compare plans</h2>
        <div className="mt-6 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="bg-elevated">
                <th className="px-5 py-3.5 text-left font-semibold text-ink">Feature</th>
                {platformPlans.map((p) => (
                  <th key={p.name} className="px-5 py-3.5 text-left font-semibold text-ink">
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
