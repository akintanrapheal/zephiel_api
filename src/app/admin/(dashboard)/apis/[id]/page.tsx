import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { getApiById, getCategories } from "@/server/catalog";
import { deleteApi, deleteEndpoint } from "@/server/actions/admin";
import DeletePlanButton from "@/components/admin/DeletePlanButton";
import ApiForm from "@/components/admin/ApiForm";
import PlanForm from "@/components/admin/PlanForm";
import EndpointForm from "@/components/admin/EndpointForm";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const api = await getApiById(id);
  return { title: api ? `Edit ${api.name}` : "API not found" };
}

export default async function EditApiPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const { created } = await searchParams;

  const [api, categories] = await Promise.all([getApiById(id), getCategories()]);
  if (!api) notFound();

  const [row] = await sql<{ category_id: string | null }[]>`
    SELECT category_id FROM apis WHERE id = ${id} LIMIT 1
  `;

  return (
    <div className="space-y-8">
      <div>
        <nav className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <Link href="/admin/apis" className="transition hover:text-ink">
            APIs
          </Link>
          <span aria-hidden>/</span>
          <span className="text-ink">{api.name}</span>
        </nav>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-ink">{api.name}</h2>
          <Link
            href={`/marketplace/${api.slug}`}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted transition hover:text-ink"
          >
            View listing
          </Link>
        </div>

        {created && (
          <p className="mt-4 rounded-xl border border-accent/30 bg-accent/5 px-4 py-2.5 text-sm text-accent">
            API created. Add its plans and endpoints below.
          </p>
        )}
      </div>

      <ApiForm api={{ ...api, categoryId: row?.category_id ?? null }} categories={categories} />

      {/* ------------------------------------------------------------ plans -- */}
      <section className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold tracking-tight text-ink">Plans</h2>
        <p className="mt-1 text-xs text-muted">
          Set a unit (e.g. <code className="font-mono">store</code>) to bill per unit instead of flat monthly.
        </p>

        <div className="mt-4 space-y-3">
          {api.plans.length === 0 && <p className="text-sm text-muted">No plans yet.</p>}

          {api.plans.map((p) => (
            <details key={p.id} className="rounded-xl border border-line bg-bg p-4">
              <summary className="flex cursor-pointer list-none items-center gap-3 text-sm marker:hidden">
                <span className="font-semibold text-ink">{p.name}</span>
                <span className="text-muted">
                  {p.price === 0 ? "Free" : `$${p.price}${p.unit ? `/${p.unit}` : ""}/mo`}
                </span>
                {p.popular && (
                  <span className="rounded-md bg-brand-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-brand-600">
                    Popular
                  </span>
                )}
                <span className="ml-auto text-xs text-muted">Edit</span>
              </summary>

              <div className="mt-4 border-t border-line pt-4">
                <PlanForm apiId={api.id!} plan={p} />
                <DeletePlanButton planId={p.id!} />
              </div>
            </details>
          ))}
        </div>

        <details className="mt-4 rounded-xl border border-dashed border-line p-4">
          <summary className="cursor-pointer list-none text-sm font-semibold text-ink marker:hidden">
            + Add a plan
          </summary>
          <div className="mt-4 border-t border-line pt-4">
            <PlanForm apiId={api.id!} />
          </div>
        </details>
      </section>

      {/* -------------------------------------------------------- endpoints -- */}
      <section className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold tracking-tight text-ink">Endpoints</h2>

        <div className="mt-4 space-y-3">
          {api.endpoints.length === 0 && <p className="text-sm text-muted">No endpoints yet.</p>}

          {api.endpoints.map((e) => (
            <details key={e.id} className="rounded-xl border border-line bg-bg p-4">
              <summary className="flex cursor-pointer list-none items-center gap-3 text-sm marker:hidden">
                <span className="w-14 shrink-0 font-mono text-[11px] font-bold text-muted">{e.method}</span>
                <code className="truncate font-mono text-xs text-ink">{e.path}</code>
                <span className="ml-auto shrink-0 text-xs text-muted">Edit</span>
              </summary>

              <div className="mt-4 border-t border-line pt-4">
                <EndpointForm apiId={api.id!} endpoint={e} />
                <form action={deleteEndpoint} className="mt-3">
                  <input type="hidden" name="id" value={e.id} />
                  <button className="text-xs font-medium text-rose-600 hover:underline">Delete endpoint</button>
                </form>
              </div>
            </details>
          ))}
        </div>

        <details className="mt-4 rounded-xl border border-dashed border-line p-4">
          <summary className="cursor-pointer list-none text-sm font-semibold text-ink marker:hidden">
            + Add an endpoint
          </summary>
          <div className="mt-4 border-t border-line pt-4">
            <EndpointForm apiId={api.id!} />
          </div>
        </details>
      </section>

      <section className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6">
        <h2 className="text-sm font-semibold tracking-tight text-ink">Delete this API</h2>
        <p className="mt-1 text-sm text-muted">
          Removes the listing, its plans, endpoints, subscriptions, and usage history. This cannot be undone.
        </p>
        <form action={deleteApi} className="mt-4">
          <input type="hidden" name="id" value={api.id} />
          <button className="rounded-xl border border-rose-500/40 px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-500/10">
            Delete {api.name}
          </button>
        </form>
      </section>
    </div>
  );
}
