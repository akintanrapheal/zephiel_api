import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getStores, getStoreActivity } from "@/server/account";
import { topUpIntraday } from "@/server/usage-maintenance";
import StoreManager from "@/components/app/StoreManager";
import StoreActivityChart from "@/components/app/StoreActivityChart";

export const dynamic = "force-dynamic";
export const metadata = { title: "Stores" };

export default async function StoresPage() {
  const user = await requireUser();

  // Fill the five-minute window up to now before reading it, so the chart is
  // current rather than frozen at whenever data was last generated.
  const [msApi] = await sql<{ id: string }[]>`SELECT id FROM apis WHERE slug = 'multistore' LIMIT 1`;
  if (msApi) await topUpIntraday(user.id, msApi.id).catch(() => ({ added: 0 }));

  const [stores, activity, sub] = await Promise.all([
    getStores(user.id),
    getStoreActivity(user.id, 6),
    sql<{ id: string; price: string; unit: string | null }[]>`
      SELECT s.id, p.price, p.unit
      FROM subscriptions s
      JOIN apis a  ON a.id = s.api_id
      JOIN plans p ON p.id = s.plan_id
      WHERE s.user_id = ${user.id} AND a.slug = 'multistore' AND s.status = 'active'
      LIMIT 1
    `,
  ]);

  const active = sub[0];
  const pricePerStore = active?.unit ? Number(active.price) : 0;

  const series = stores.map((s) => ({
    id: s.id,
    name: s.name,
    values: activity.byStore[s.id] ?? activity.buckets.map(() => 0),
  }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Stores</h1>
          <p className="mt-1 text-sm text-muted">
            Storefronts connected through the{" "}
            <Link href="/marketplace/multistore" className="font-medium text-brand-600 hover:underline">
              Multistore API
            </Link>
            , each with its own key.
          </p>
        </div>
      </header>

      {stores.length > 0 && (
        <section className="rounded-2xl border border-line bg-surface p-6">
          <StoreActivityChart buckets={activity.buckets} series={series} />
        </section>
      )}

      <StoreManager
        stores={stores}
        canAdd={Boolean(active)}
        pricePerStore={pricePerStore || 50}
      />
    </div>
  );
}
