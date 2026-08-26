import Link from "next/link";
import { getCategories } from "@/server/catalog";
import ApiForm from "@/components/admin/ApiForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "New API" };

export default async function NewApiPage() {
  const categories = await getCategories();

  return (
    <div>
      <nav className="flex items-center gap-2 text-sm text-muted">
        <Link href="/admin/apis" className="transition hover:text-ink">
          APIs
        </Link>
        <span aria-hidden>/</span>
        <span className="text-ink">New</span>
      </nav>

      <h2 className="mt-4 text-lg font-semibold tracking-tight text-ink">Add an API</h2>
      <p className="mt-1 text-sm text-muted">
        Create the listing first, then add its plans and endpoints on the next screen.
      </p>

      <div className="mt-6">
        <ApiForm categories={categories} />
      </div>
    </div>
  );
}
