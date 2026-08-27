import type { Metadata } from "next";
import Link from "next/link";
import { getPosts } from "@/server/posts";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Blog",
  description: "Engineering notes and platform updates from the Zephiel team.",
};

export default async function BlogPage() {
  const posts = await getPosts();

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Blog</h1>
        <p className="mt-3 text-[15px] leading-7 text-muted">
          Platform updates and engineering notes from the team building Zephiel.
        </p>
      </header>

      {posts.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-dashed border-line px-5 py-12 text-center text-sm text-muted">
          Nothing published yet.
        </p>
      ) : (
        <div className="mt-10 space-y-4">
          {posts.map((p) => (
            <article
              key={p.slug}
              className="group rounded-2xl border border-line bg-surface p-6 transition hover:border-brand-300 hover:shadow-card"
            >
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                <span className="rounded-md bg-elevated px-2 py-1 font-medium">{p.tag}</span>
                <span>
                  {new Date(p.publishedAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <span aria-hidden>&middot;</span>
                <span>{p.readMinutes} min read</span>
              </div>

              <h2 className="mt-3 text-lg font-semibold tracking-tight text-ink">
                <Link href={`/blog/${p.slug}`} className="transition group-hover:text-brand-600">
                  {p.title}
                </Link>
              </h2>
              <p className="mt-2 text-sm leading-7 text-muted">{p.excerpt}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
