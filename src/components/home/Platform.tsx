import Link from "next/link";

const pillars = [
  {
    title: "One key, every API",
    body: "The same header authenticates every listing. No per-vendor accounts, no separate credentials rotting in separate secret stores, no procurement queue per integration.",
    icon: "M15 7a4 4 0 1 1 4 4h-3v3l-2 2-2-2-2 2-3-3 7-7a4 4 0 0 1 1-1z",
    points: ["One header everywhere", "Rotate without downtime", "Revoke one, keep the rest"],
  },
  {
    title: "Buy calls once, spend anywhere",
    body: "A platform plan pools your allowance across the whole catalog, so you are not guessing which vendor deserves a commitment before you have the traffic to justify it.",
    icon: "M3 17l6-6 4 4 8-8M21 7v5h-5",
    points: ["Pooled monthly quota", "Change plans in one click", "Overage instead of hard failure"],
  },
  {
    title: "The same contract, every time",
    body: "One base URL, one error envelope, one rate-limit header. Learn it once and every listing behaves the way you already expect it to.",
    icon: "M8 6l-5 6 5 6M16 6l5 6-5 6",
    points: ["Consistent response shapes", "Predictable status codes", "Samples in four languages"],
  },
];

export default function Platform() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">One account</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Everything behind a single integration surface
        </h2>
        <p className="mt-4 text-[15px] leading-8 text-muted">
          The slowest part of adding an API is rarely the code. It is the account, the contract, the
          invoice, and the key that outlives whoever added it.
        </p>
      </div>

      <div className="mt-14 grid gap-5 lg:grid-cols-3">
        {pillars.map((p) => (
          <div
            key={p.title}
            className="group relative overflow-hidden rounded-2xl border border-line bg-surface p-7 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lift"
          >
            <div
              aria-hidden
              className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-brand-500/[0.07] transition group-hover:bg-brand-500/[0.12]"
            />

            <span className="relative grid h-11 w-11 place-items-center rounded-xl bg-brand-500/10 text-brand-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden className="h-5 w-5">
                <path d={p.icon} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>

            <h3 className="relative mt-5 text-lg font-semibold tracking-tight text-ink">{p.title}</h3>
            <p className="relative mt-2.5 text-sm leading-7 text-muted">{p.body}</p>

            <ul className="relative mt-5 space-y-2 border-t border-line pt-4">
              {p.points.map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-sm text-muted">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    aria-hidden
                    className="mt-1 h-3.5 w-3.5 shrink-0 text-accent"
                  >
                    <path d="M4 12.5l5 5L20 6.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-10 text-center">
        <Link
          href="/docs"
          className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-6 py-3 text-sm font-semibold text-ink transition hover:bg-elevated"
        >
          Read the integration guide
          <span aria-hidden>&rarr;</span>
        </Link>
      </div>
    </section>
  );
}
