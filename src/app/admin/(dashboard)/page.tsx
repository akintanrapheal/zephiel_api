import Link from "next/link";
import { getAdminStats, getTopApisByUsage, listPayments } from "@/server/admin";
import { compact } from "@/lib/utils";
import { isConfigured } from "@/lib/paystack";
import PageHeader, { Card, Empty, StatTile } from "@/components/admin/PageHeader";

export const dynamic = "force-dynamic";
export const metadata = { title: "Overview" };

const icons = {
  grid: "M4 13h6V4H4v9zm0 7h6v-5H4v5zm10 0h6V11h-6v9zm0-16v5h6V4h-6z",
  card: "M3 10h18M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z",
  trend: "M3 17l6-6 4 4 8-8M21 7v5h-5",
  bolt: "M13 3L5 14h6l-2 7 8-11h-6l2-7z",
};

export default async function AdminOverviewPage() {
  const [stats, topApis, payments, paystackReady] = await Promise.all([
    getAdminStats(),
    getTopApisByUsage(),
    listPayments(),
    isConfigured(),
  ]);

  const recent = payments.slice(0, 6);
  const maxCalls = Math.max(1, ...topApis.map((a) => Number(a.calls)));
  const noTraffic = topApis.every((a) => Number(a.calls) === 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="Catalog health, revenue, and traffic across the platform."
        action={
          <Link
            href="/admin/apis/new"
            className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            Add an API
          </Link>
        }
      />

      {!paystackReady && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="mt-0.5 h-4 w-4 shrink-0 text-amber-600">
            <path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="text-sm text-muted">
            <span className="font-semibold text-ink">Paystack is not configured.</span> Free plans still
            activate, but paid checkout is unavailable until a secret key is set in{" "}
            <Link href="/admin/settings" className="font-semibold text-brand-600 underline">
              Settings
            </Link>
            .
          </p>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Published APIs"
          value={String(stats.published)}
          sub={`${stats.apis} total in catalog`}
          icon={icons.grid}
          tone="brand"
        />
        <StatTile
          label="Active subscriptions"
          value={String(stats.activeSubs)}
          sub={stats.pendingSubs > 0 ? `${stats.pendingSubs} awaiting payment` : "None pending"}
          icon={icons.card}
          tone="accent"
        />
        <StatTile
          label="Monthly recurring"
          value={`$${stats.mrr.toLocaleString()}`}
          sub={`$${stats.revenue.toLocaleString()} collected to date`}
          icon={icons.trend}
          tone={stats.mrr > 0 ? "accent" : "default"}
        />
        <StatTile
          label="Calls (30 days)"
          value={compact(stats.calls30d)}
          sub={`${stats.users} account${stats.users === 1 ? "" : "s"}, ${stats.admins} admin`}
          icon={icons.bolt}
          tone="default"
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Single-series magnitude: one hue, direct labels, no legend needed. */}
        <Card title="Calls by API" action={<span className="text-xs text-muted">Last 30 days</span>} padded>
          {noTraffic ? (
            <p className="py-6 text-sm text-muted">
              No traffic recorded yet. Calls appear here once a key is used against the gateway at{" "}
              <code className="rounded bg-elevated px-1.5 py-0.5 font-mono text-xs">/api/v1/…</code>
            </p>
          ) : (
            <div className="space-y-3">
              {topApis.map((a) => {
                const calls = Number(a.calls);
                return (
                  <div key={a.name} className="flex items-center gap-3">
                    <span className="w-32 shrink-0 truncate text-xs text-ink">{a.name}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-elevated">
                      <div
                        className="h-full rounded-full bg-brand-500 dark:bg-brand-400"
                        style={{ width: `${Math.max(2, (calls / maxCalls) * 100)}%` }}
                      />
                    </div>
                    <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted">
                      {compact(calls)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card
          title="Recent payments"
          action={
            <Link href="/admin/payments" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
              View all
            </Link>
          }
        >
          {recent.length === 0 ? (
            <Empty
              title="No payments yet"
              hint="Transactions appear here as soon as a customer checks out a paid plan."
            />
          ) : (
            <div className="divide-y divide-line">
              {recent.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">{p.email ?? "—"}</p>
                    <p className="truncate text-xs text-muted">{p.api_name ?? "—"}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">
                    {p.currency} {Number(p.amount).toLocaleString()}
                  </span>
                  <span
                    className={
                      p.status === "success"
                        ? "shrink-0 rounded-md bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase text-accent"
                        : "shrink-0 rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-600"
                    }
                  >
                    {p.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="Quick actions" padded>
        <div className="flex flex-wrap gap-2">
          {[
            { href: "/admin/apis/new", label: "Add an API", primary: true },
            { href: "/admin/categories", label: "Manage categories" },
            { href: "/admin/users", label: "Manage users" },
            { href: "/admin/subscriptions", label: "Review subscriptions" },
          ].map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className={
                a.primary
                  ? "rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
                  : "rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-elevated"
              }
            >
              {a.label}
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
