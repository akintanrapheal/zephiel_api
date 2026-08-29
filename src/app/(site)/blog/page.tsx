import type { Metadata } from "next";
import Link from "next/link";
import { getPosts } from "@/server/posts";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Engineering notes and platform updates from the Zephiel team, published since 2015.",
};

export default async function BlogPage() {
  const posts = await getPosts();

  // Grouped by year: an archive going back a decade reads as a history rather
  // than a list only if the years are visible.
  const byYear = new Map<number, typeof posts>();
  for (const p of posts) {
    const year = new Date(p.publishedAt).getFullYear();
    byYear.set(year, [...(byYear.get(year) ?? []), p]);
  }
  const years = [...byYear.keys()].sort((a, b) => b - a);
  const firstYear = years.at(-1);

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Blog</h1>
        <p className="mt-3 text-[15px] leading-7 text-muted">
          Platform updates and engineering notes from the team building Zephiel.
          {firstYear && (
            <>
              {" "}
              {posts.length} posts, published since {firstYear}.
            </>
          )}
        </p>
      </header>

      {years.length > 1 && (
        <nav aria-label="Archive by year" className="mt-8 flex flex-wrap gap-2">
          {years.map((y) => (
            <a
              key={y}
              href={`#y${y}`}
              className="rounded-full border border-line px-3 py-1.5 text-xs font-medium tabular-nums text-muted transition hover:border-brand-300 hover:text-brand-600"
            >
              {y}
              <span className="ml-1.5 opacity-60">{byYear.get(y)!.length}</span>
            </a>
          ))}
        </nav>
      )}

      {posts.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-dashed border-line px-5 py-12 text-center text-sm text-muted">
          Nothing published yet.
        </p>
      ) : (
        <div className="mt-12 space-y-12">
          {years.map((year) => (
            <section key={year} id={`y${year}`} className="scroll-mt-24">
              <div className="flex items-center gap-4">
                <h2 className="text-sm font-semibold tabular-nums tracking-tight text-ink">{year}</h2>
                <span className="h-px flex-1 bg-line" />
                <span className="text-xs text-muted">
                  {byYear.get(year)!.length} {byYear.get(year)!.length === 1 ? "post" : "posts"}
                </span>
              </div>

              <div className="mt-5 space-y-4">
                {byYear.get(year)!.map((p) => (
                  <article
                    key={p.slug}
                    className="group rounded-2xl border border-line bg-surface p-6 transition hover:border-brand-300 hover:shadow-card"
                  >
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                      <span className="rounded-md bg-elevated px-2 py-1 font-medium">{p.tag}</span>
                      <time dateTime={new Date(p.publishedAt).toISOString()}>
                        {new Date(p.publishedAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </time>
                      <span aria-hidden>&middot;</span>
                      <span>{p.readMinutes} min read</span>
                    </div>

                    <h3 className="mt-3 text-lg font-semibold tracking-tight text-ink">
                      <Link href={`/blog/${p.slug}`} className="transition group-hover:text-brand-600">
                        {p.title}
                      </Link>
                    </h3>
                    <p className="mt-2 text-sm leading-7 text-muted">{p.excerpt}</p>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
