import Link from "next/link";
import { listApisForAdmin } from "@/server/admin";
import { toggleApiPublished } from "@/server/actions/admin";
import PageHeader, { Empty } from "@/components/admin/PageHeader";
import ApiIcon from "@/components/ApiIcon";

export const dynamic = "force-dynamic";
export const metadata = { title: "APIs" };

export default async function AdminApisPage() {
  const apis = await listApisForAdmin();

  return (
    <div>
      <PageHeader
        title="APIs"
        description={`${apis.length} listing${apis.length === 1 ? "" : "s"} in the catalog`}
        action={
          <Link
            href="/admin/apis/new"
            className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            Add an API
          </Link>
        }
      />

      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        {apis.length === 0 ? (
          <Empty
            title="No APIs yet"
            hint="Create one here, or run npm run db:seed to load the starter catalog."
          />
        ) : (
          <div className="divide-y divide-line">
            {apis.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition hover:bg-elevated/40">
                <ApiIcon api={a} size="sm" />

                <div className="min-w-0 flex-1">
                  <Link
                    href={`/admin/apis/${a.id}`}
                    className="truncate text-sm font-semibold text-ink hover:text-brand-600"
                  >
                    {a.name}
                  </Link>
                  <p className="truncate text-xs text-muted">
                    /{a.slug} &middot; {a.category ?? "Uncategorised"} &middot; {a.plan_count} plans
                  </p>
                </div>

                <span className="shrink-0 text-xs tabular-nums text-muted">
                  {a.subscriber_count} subs
                </span>

                {a.featured && (
                  <span className="shrink-0 rounded-md bg-brand-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-brand-600">
                    Featured
                  </span>
                )}

                <span
                  className={
                    a.published
                      ? "shrink-0 rounded-md bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase text-accent"
                      : "shrink-0 rounded-md bg-elevated px-2 py-0.5 text-[10px] font-bold uppercase text-muted"
                  }
                >
                  {a.published ? "Live" : "Draft"}
                </span>

                <form action={toggleApiPublished} className="shrink-0">
                  <input type="hidden" name="id" value={a.id} />
                  <button className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted transition hover:text-ink">
                    {a.published ? "Unpublish" : "Publish"}
                  </button>
                </form>

                <Link
                  href={`/admin/apis/${a.id}`}
                  className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted transition hover:text-ink"
                >
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
