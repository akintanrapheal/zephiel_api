import Link from "next/link";
import { getPosts } from "@/server/posts";
import PageHeader, { Empty } from "@/components/admin/PageHeader";

export const dynamic = "force-dynamic";
export const metadata = { title: "Posts" };

export default async function AdminPostsPage() {
  const posts = await getPosts({ limit: 100, includeDrafts: true });

  return (
    <div>
      <PageHeader
        title="Posts"
        description={`${posts.length} post${posts.length === 1 ? "" : "s"}`}
        action={
          <Link
            href="/admin/posts/new"
            className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            Write a post
          </Link>
        }
      />

      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        {posts.length === 0 ? (
          <Empty title="No posts yet" hint="Write one to fill the blog and the homepage teaser." />
        ) : (
          <div className="divide-y divide-line">
            {posts.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition hover:bg-elevated/40">
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/posts/${p.id}`} className="truncate text-sm font-semibold text-ink hover:text-brand-600">
                    {p.title}
                  </Link>
                  <p className="truncate text-xs text-muted">
                    /{p.slug} &middot; {p.tag} &middot; {p.readMinutes} min
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted">
                  {new Date(p.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </span>
                <span
                  className={
                    p.published
                      ? "shrink-0 rounded-md bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase text-accent"
                      : "shrink-0 rounded-md bg-elevated px-2 py-0.5 text-[10px] font-bold uppercase text-muted"
                  }
                >
                  {p.published ? "Live" : "Draft"}
                </span>
                <Link href={`/admin/posts/${p.id}`} className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted transition hover:text-ink">
                  Edit
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
