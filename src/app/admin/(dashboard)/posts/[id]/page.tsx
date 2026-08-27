import Link from "next/link";
import { notFound } from "next/navigation";
import { getPostById } from "@/server/posts";
import { deletePost } from "@/server/actions/posts";
import PageHeader, { Card } from "@/components/admin/PageHeader";
import PostForm from "@/components/admin/PostForm";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getPostById(id);
  return { title: post ? `Edit ${post.title}` : "Post not found" };
}

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getPostById(id);
  if (!post) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={post.title}
        breadcrumb={[{ href: "/admin/posts", label: "Posts" }, { label: post.title }]}
        action={
          <Link
            href={`/blog/${post.slug}`}
            className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-elevated"
          >
            View post
          </Link>
        }
      />

      <PostForm post={post} />

      <Card title="Delete this post" padded>
        <form action={deletePost}>
          <input type="hidden" name="id" value={post.id} />
          <button className="rounded-xl border border-rose-500/40 px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-500/10">
            Delete permanently
          </button>
        </form>
      </Card>
    </div>
  );
}
