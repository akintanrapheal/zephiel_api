import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPost, getPosts } from "@/server/posts";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Post not found" };
  return { title: post.title, description: post.excerpt };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const others = (await getPosts({ limit: 4 })).filter((p) => p.slug !== slug).slice(0, 3);

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <nav className="flex items-center gap-2 text-sm text-muted">
        <Link href="/blog" className="transition hover:text-ink">
          Blog
        </Link>
        <span aria-hidden>/</span>
        <span className="truncate text-ink">{post.title}</span>
      </nav>

      <article className="mt-8">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
          <span className="rounded-md bg-brand-500/10 px-2 py-1 font-semibold uppercase tracking-wide text-brand-600">
            {post.tag}
          </span>
          <span>
            {new Date(post.publishedAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
          <span aria-hidden>&middot;</span>
          <span>{post.readMinutes} min read</span>
        </div>

        <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
          {post.title}
        </h1>
        <p className="mt-4 text-[17px] leading-8 text-muted">{post.excerpt}</p>

        <div className="mt-10 space-y-5 border-t border-line pt-8">
          {post.body
            .split(/\n{2,}/)
            .filter(Boolean)
            .map((para, i) =>
              para.startsWith("## ") ? (
                <h2 key={i} className="pt-4 text-xl font-semibold tracking-tight text-ink">
                  {para.replace(/^##\s+/, "")}
                </h2>
              ) : (
                <p key={i} className="text-[15px] leading-8 text-muted">
                  {para}
                </p>
              )
            )}
        </div>
      </article>

      {others.length > 0 && (
        <section className="mt-16 border-t border-line pt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink">Keep reading</h2>
          <div className="mt-5 space-y-3">
            {others.map((p) => (
              <Link
                key={p.slug}
                href={`/blog/${p.slug}`}
                className="block rounded-xl border border-line bg-surface p-4 transition hover:border-brand-300"
              >
                <p className="text-sm font-semibold text-ink">{p.title}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-6 text-muted">{p.excerpt}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
