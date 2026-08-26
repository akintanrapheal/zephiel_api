import { listCategoriesForAdmin } from "@/server/admin";
import { deleteCategory } from "@/server/actions/admin";
import CategoryForm from "@/components/admin/CategoryForm";
import PageHeader from "@/components/admin/PageHeader";

export const dynamic = "force-dynamic";
export const metadata = { title: "Categories" };

export default async function AdminCategoriesPage() {
  const categories = await listCategoriesForAdmin();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        description={`${categories.length} categor${categories.length === 1 ? "y" : "ies"} — click one to edit it`}
      />

      <div className="space-y-3">
        {categories.map((c) => (
          <details key={c.id} className="rounded-2xl border border-line bg-surface p-5">
            <summary className="flex cursor-pointer list-none items-center gap-3 marker:hidden">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-500/10 text-brand-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4">
                  <path d={c.icon} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{c.name}</span>
                <span className="block truncate text-xs text-muted">
                  /{c.slug} &middot; {c.api_count} APIs
                </span>
              </span>
              <span className="shrink-0 text-xs text-muted">Edit</span>
            </summary>

            <div className="mt-4 border-t border-line pt-4">
              <CategoryForm category={c} />
              <form action={deleteCategory} className="mt-3">
                <input type="hidden" name="id" value={c.id} />
                <button className="text-xs font-medium text-rose-600 hover:underline">
                  Delete category
                </button>
              </form>
              <p className="mt-2 text-xs text-muted">
                Deleting keeps its {c.api_count} APIs — they become uncategorised.
              </p>
            </div>
          </details>
        ))}
      </div>

      <details className="rounded-2xl border border-dashed border-line p-5">
        <summary className="cursor-pointer list-none text-sm font-semibold text-ink marker:hidden">
          + Add a category
        </summary>
        <div className="mt-4 border-t border-line pt-4">
          <CategoryForm />
        </div>
      </details>
    </div>
  );
}
