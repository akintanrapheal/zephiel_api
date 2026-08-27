import Link from "next/link";
import { sql } from "@/lib/db";
import { adminDeleteReview } from "@/server/actions/admin-reviews";
import PageHeader, { Card, Empty } from "@/components/admin/PageHeader";
import AdminReviewForm from "@/components/admin/ReviewForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reviews" };

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ api?: string }>;
}) {
  const { api: apiFilter } = await searchParams;

  const apis = await sql<
    { id: string; name: string; slug: string; rating: string; reviews: number }[]
  >`SELECT id, name, slug, rating, reviews FROM apis ORDER BY name`;

  const reviews = await sql<
    {
      id: string;
      api_id: string;
      api_name: string;
      rating: number;
      author: string;
      role: string;
      title: string;
      body: string;
      created_at: Date;
      from_customer: boolean;
    }[]
  >`
    SELECT r.id, r.api_id, a.name AS api_name, r.rating,
           COALESCE(NULLIF(r.author_name, ''), u.name, 'Customer') AS author,
           r.role, r.title, r.body, r.created_at,
           (r.user_id IS NOT NULL) AS from_customer
    FROM reviews r
    JOIN apis a ON a.id = r.api_id
    LEFT JOIN users u ON u.id = r.user_id
    ${apiFilter ? sql`WHERE a.slug = ${apiFilter}` : sql``}
    ORDER BY r.created_at DESC
    LIMIT 200
  `;

  const selected = apis.find((a) => a.slug === apiFilter);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reviews"
        description={
          selected
            ? `${reviews.length} on ${selected.name} — rated ${Number(selected.rating).toFixed(1)}`
            : `${reviews.length} across the catalogue`
        }
      />

      <Card title="Add a review" padded>
        <AdminReviewForm
          apis={apis.map((a) => ({ id: a.id, name: a.name }))}
          defaultApiId={selected?.id}
        />
      </Card>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/reviews"
          className={
            !apiFilter
              ? "rounded-full border border-brand-600 bg-brand-600 px-3.5 py-1.5 text-xs font-medium text-white"
              : "rounded-full border border-line px-3.5 py-1.5 text-xs font-medium text-muted transition hover:text-ink"
          }
        >
          All APIs
        </Link>
        {apis
          .filter((a) => a.reviews > 0)
          .map((a) => (
            <Link
              key={a.id}
              href={`/admin/reviews?api=${a.slug}`}
              className={
                apiFilter === a.slug
                  ? "rounded-full border border-brand-600 bg-brand-600 px-3.5 py-1.5 text-xs font-medium text-white"
                  : "rounded-full border border-line px-3.5 py-1.5 text-xs font-medium text-muted transition hover:text-ink"
              }
            >
              {a.name} <span className="opacity-60">{a.reviews}</span>
            </Link>
          ))}
      </div>

      {reviews.length === 0 ? (
        <Empty title="No reviews yet" hint="Add one above, or clear the filter." />
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <details key={r.id} className="rounded-2xl border border-line bg-surface p-5">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 marker:hidden">
                <span className="flex shrink-0 gap-0.5 text-amber-500" title={`${r.rating} out of 5`}>
                  {Array.from({ length: r.rating }).map((_, i) => (
                    <svg
                      key={i}
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden
                      className="h-3.5 w-3.5"
                    >
                      <path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.4l6.5-.9L12 2.6z" />
                    </svg>
                  ))}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">
                    {r.author}
                    {r.role && <span className="font-normal text-muted"> · {r.role}</span>}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {r.api_name} ·{" "}
                    {new Date(r.created_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </span>
                {r.from_customer && (
                  <span className="shrink-0 rounded-md bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase text-accent">
                    Customer
                  </span>
                )}
                <span className="shrink-0 text-xs text-muted">Edit</span>
              </summary>

              <div className="mt-4 border-t border-line pt-4">
                <AdminReviewForm
                  apis={apis.map((a) => ({ id: a.id, name: a.name }))}
                  review={{
                    id: r.id,
                    apiId: r.api_id,
                    rating: r.rating,
                    authorName: r.author,
                    role: r.role,
                    title: r.title,
                    body: r.body,
                  }}
                />
                <form action={adminDeleteReview} className="mt-3">
                  <input type="hidden" name="id" value={r.id} />
                  <button className="text-xs font-medium text-rose-600 hover:underline">
                    Delete this review
                  </button>
                </form>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
