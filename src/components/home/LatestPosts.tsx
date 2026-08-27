import Link from "next/link";
import type { Post } from "@/server/posts";

export default function LatestPosts({ posts }: { posts: Post[] }) {
  if (posts.length === 0) return null;

  return (
    <section className="border-t border-line bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">
              From the team
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              Notes on running the platform
            </h2>
          </div>
          <Link href="/blog" className="text-sm font-semibold text-brand-600 transition hover:text-brand-700">
            All posts &rarr;
          </Link>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {posts.slice(0, 3).map((p) => (
            <Link
              key={p.slug}
              href={`/blog/${p.slug}`}
              className="group flex flex-col rounded-2xl border border-line bg-bg p-6 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card"
            >
              <div className="flex items-center gap-2.5 text-xs">
                <span className="rounded-md bg-brand-500/10 px-2 py-1 font-semibold uppercase tracking-wide text-brand-600">
                  {p.tag}
                </span>
                <span className="text-muted">{p.readMinutes} min read</span>
              </div>

              <h3 className="mt-4 flex-1 text-base font-semibold leading-7 tracking-tight text-ink">
                {p.title}
              </h3>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted">{p.excerpt}</p>

              <div className="mt-5 flex items-center justify-between border-t border-line pt-4 text-xs">
                <span className="text-muted">
                  {new Date(p.publishedAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                <span className="font-semibold text-brand-600">
                  Read more <span aria-hidden>&rarr;</span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
