import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Blog",
  description: "Engineering notes and platform updates from the Zephiel team.",
};

const posts = [
  {
    title: "Why we publish our p99, not our p50",
    excerpt:
      "Median latency is a marketing number. The tail is what pages your on-call. Here is every percentile we measure and how we collect it.",
    date: "Aug 18, 2026",
    tag: "Engineering",
    read: "6 min",
  },
  {
    title: "Rate limiting without punishing bursty clients",
    excerpt:
      "Sliding windows, token buckets, and why we settled on a hybrid that absorbs a 10x burst without letting a runaway loop drain your quota.",
    date: "Aug 4, 2026",
    tag: "Engineering",
    read: "9 min",
  },
  {
    title: "Six new APIs joined the marketplace",
    excerpt:
      "Air quality, VAT validation, speech to text, and three more — all live with free tiers and full reference docs.",
    date: "Jul 22, 2026",
    tag: "Product",
    read: "3 min",
  },
  {
    title: "A single error envelope across 24 vendors",
    excerpt:
      "Normalizing upstream failures is unglamorous work. It is also the single thing developers thank us for most.",
    date: "Jul 9, 2026",
    tag: "Engineering",
    read: "7 min",
  },
];

export default function BlogPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Blog</h1>
        <p className="mt-3 text-[15px] leading-7 text-muted">
          Platform updates and engineering notes from the team building Zephiel.
        </p>
      </header>

      <div className="mt-10 space-y-4">
        {posts.map((p) => (
          <article
            key={p.title}
            className="group rounded-2xl border border-line bg-surface p-6 transition hover:border-brand-300 hover:shadow-card"
          >
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
              <span className="rounded-md bg-elevated px-2 py-1 font-medium">{p.tag}</span>
              <span>{p.date}</span>
              <span>&middot;</span>
              <span>{p.read} read</span>
            </div>
            <h2 className="mt-3 text-lg font-semibold tracking-tight text-ink">
              <Link href="/blog">{p.title}</Link>
            </h2>
            <p className="mt-2 text-sm leading-7 text-muted">{p.excerpt}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
