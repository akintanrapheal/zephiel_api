import Link from "next/link";
import { getAdminStats, getTopApisByUsage, listPayments } from "@/server/admin";
import { compact } from "@/lib/utils";
import { isConfigured } from "@/lib/paystack";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const [stats, topApis, payments] = await Promise.all([
    getAdminStats(),
    getTopApisByUsage(),
    listPayments(),
  ]);

  const recent = payments.slice(0, 6);
  const maxCalls = Math.max(1, ...topApis.map((a) => Number(a.calls)));

  const tiles = [
    { label: "Published APIs", value: `${stats.published}`, sub: `${stats.apis} total` },
    { label: "Active subscriptions", value: `${stats.activeSubs}`, sub: `${stats.pendingSubs} pending` },
    { label: "Monthly recurring", value: `$${stats.mrr.toLocaleString()}`, sub: "From active plans" },
    { label: "Calls (30 days)", value: compact(stats.calls30d), sub: `${stats.users} accounts` },
  ];

  return (
    <div className="space-y-8">
      {!isConfigured() && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-muted">
          <span className="font-semibold text-ink">Paystack is not configured.</span> Free plans still
          activate, but paid subscriptions cannot check out until{" "}
          <code className="rounded bg-elevated px-1.5 py-0.5 font-mono text-xs">PAYSTACK_SECRET_KEY</code> is set.
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">{t.label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-ink">{t.value}</p>
            <p className="mt-1 text-xs text-muted">{t.sub}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Single-series magnitude: one hue, direct labels, no legend needed. */}
        <section className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="text-sm font-semibold tracking-tight text-ink">Calls by API</h2>
          <p className="mt-0.5 text-xs text-muted">Last 30 days</p>

          {topApis.every((a) => Number(a.calls) === 0) ? (
            <p className="mt-6 text-sm text-muted">
              No traffic recorded yet. Calls appear here once a key is used against the gateway.
            </p>
          ) : (
            <div className="mt-5 space-y-3">
              {topApis.map((a) => {
                const calls = Number(a.calls);
                return (
                  <div key={a.name} className="flex items-center gap-3">
                    <span className="w-36 shrink-0 truncate text-xs text-ink">{a.name}</span>
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
        </section>

        <section className="rounded-2xl border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-sm font-semibold tracking-tight text-ink">Recent payments</h2>
            <Link href="/admin/payments" className="text-xs font-semibold text-brand-600">
              View all
            </Link>
          </div>

          {recent.length === 0 ? (
            <p className="px-5 py-8 text-sm text-muted">No payments yet.</p>
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
        </section>
      </div>

      <section className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold tracking-tight text-ink">Quick actions</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/admin/apis/new"
            className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            Add an API
          </Link>
          <Link
            href="/admin/categories"
            className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-elevated"
          >
            Manage categories
          </Link>
          <Link
            href="/admin/users"
            className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-elevated"
          >
            Manage users
          </Link>
        </div>
      </section>
    </div>
  );
}
