const quotes = [
  {
    body: "We were paying four vendors and reconciling four invoices. Consolidating onto one key took an afternoon, and finance stopped asking me what half the line items were.",
    name: "Amara Okonkwo",
    role: "Engineering Lead",
    company: "Kite Freight",
    initials: "AO",
    tone: "#2445d6",
  },
  {
    body: "The free tier is what sold us. We prototyped the whole geolocation flow before anyone had to approve a purchase order, then upgraded the week we launched.",
    name: "Daniel Kessler",
    role: "CTO",
    company: "Halyard",
    initials: "DK",
    tone: "#7c3aed",
  },
  {
    body: "One error envelope across every provider sounds like a small thing. It removed about four hundred lines of vendor-specific handling from our codebase.",
    name: "Priya Sundaram",
    role: "Staff Engineer",
    company: "Meridian",
    initials: "PS",
    tone: "#0891b2",
  },
  {
    body: "Latency has held under a hundred milliseconds from eu-west for eight months, and the status page has matched what we actually observed. That earns a lot of trust.",
    name: "Tomás Ferreira",
    role: "Platform Engineer",
    company: "Brightloom",
    initials: "TF",
    tone: "#059669",
  },
];

export default function Testimonials() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">
          From the teams using it
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Fewer vendors, fewer invoices, less glue code
        </h2>
      </div>

      <div className="mt-12 grid gap-5 sm:grid-cols-2">
        {quotes.map((q) => (
          <figure
            key={q.name}
            className="flex flex-col rounded-2xl border border-line bg-surface p-7 transition hover:border-brand-300 hover:shadow-card"
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden
              className="h-7 w-7 text-brand-500/25"
            >
              <path d="M9.5 5C6.5 6.6 5 9.2 5 12.8V19h6v-6H8.2c0-2.5.9-4.2 2.8-5.2L9.5 5zm9 0c-3 1.6-4.5 4.2-4.5 7.8V19h6v-6h-2.8c0-2.5.9-4.2 2.8-5.2L18.5 5z" />
            </svg>

            <blockquote className="mt-4 flex-1 text-[15px] leading-8 text-ink">
              {q.body}
            </blockquote>

            <figcaption className="mt-6 flex items-center gap-3 border-t border-line pt-5">
              <span
                aria-hidden
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
                style={{ background: `linear-gradient(140deg, ${q.tone}, ${q.tone}bb)` }}
              >
                {q.initials}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-ink">{q.name}</span>
                <span className="block truncate text-xs text-muted">
                  {q.role}, {q.company}
                </span>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-muted">
        Illustrative quotes from the sample companies used throughout this demo.
      </p>
    </section>
  );
}
