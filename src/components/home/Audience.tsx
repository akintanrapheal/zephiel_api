import Link from "next/link";

const segments = [
  {
    name: "Developers",
    line: "Ship the integration this afternoon.",
    body: "One key, consistent response shapes, and a free tier on every listing — so you can prototype without a procurement conversation.",
    points: ["Free tier on every API", "Copy-paste samples in four languages", "One error envelope to handle"],
    icon: "M8 6l-5 6 5 6M16 6l5 6-5 6",
    href: "/docs",
    cta: "Read the docs",
  },
  {
    name: "Startups",
    line: "Buy calls once, spend them anywhere.",
    body: "Pooled quotas across the whole catalog mean you are not guessing which vendor to commit to before you have traffic.",
    points: ["Pooled monthly quota", "Change plans in one click", "No annual lock-in"],
    icon: "M13 3L5 14h6l-2 7 8-11h-6l2-7z",
    href: "/pricing",
    cta: "Compare plans",
    featured: true,
  },
  {
    name: "Enterprise",
    line: "One contract instead of twelve.",
    body: "Consolidate vendor management, security review, and invoicing into a single agreement with the SLAs and paperwork your team expects.",
    points: ["Custom SLA, DPA, and SSO", "Volume pricing", "Dedicated success manager"],
    icon: "M3 21h18M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M15 21V10h4v11M8 7h2M8 11h2M8 15h2",
    href: "/contact",
    cta: "Talk to sales",
  },
];

export default function Audience() {
  return (
    <section className="border-y border-line bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">
            Built for
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            However far along you are
          </h2>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {segments.map((s) => (
            <div
              key={s.name}
              className={
                s.featured
                  ? "relative flex flex-col rounded-2xl border-2 border-brand-500 bg-bg p-7 shadow-lift"
                  : "relative flex flex-col rounded-2xl border border-line bg-bg p-7 transition hover:border-brand-300 hover:shadow-card"
              }
            >
              <span
                className={
                  s.featured
                    ? "grid h-11 w-11 place-items-center rounded-xl bg-brand-600 text-white"
                    : "grid h-11 w-11 place-items-center rounded-xl bg-brand-500/10 text-brand-600"
                }
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden className="h-5 w-5">
                  <path d={s.icon} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>

              <h3 className="mt-5 text-lg font-semibold tracking-tight text-ink">{s.name}</h3>
              <p className="mt-1 text-sm font-medium text-brand-600">{s.line}</p>
              <p className="mt-3 text-sm leading-7 text-muted">{s.body}</p>

              <ul className="mt-5 flex-1 space-y-2.5">
                {s.points.map((p) => (
                  <li key={p} className="flex items-start gap-2.5 text-sm text-muted">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden className="mt-1 h-3.5 w-3.5 shrink-0 text-accent">
                      <path d="M4 12.5l5 5L20 6.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {p}
                  </li>
                ))}
              </ul>

              <Link
                href={s.href}
                className={
                  s.featured
                    ? "mt-7 rounded-xl bg-brand-600 px-5 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-brand-700"
                    : "mt-7 rounded-xl border border-line px-5 py-2.5 text-center text-sm font-semibold text-ink transition hover:bg-elevated"
                }
              >
                {s.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
