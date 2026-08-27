import PageHeader from "@/components/admin/PageHeader";
import PostForm from "@/components/admin/PostForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "New post" };

export default function NewPostPage() {
  return (
    <div>
      <PageHeader
        title="Write a post"
        description="Appears on the blog and in the homepage teaser once published."
        breadcrumb={[{ href: "/admin/posts", label: "Posts" }, { label: "New" }]}
      />
      <PostForm />
    </div>
  );
}
