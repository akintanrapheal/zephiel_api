import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  getAccountSummary,
  getApiKeys,
  getRecentRequests,
  getSubscriptions,
  getUsageSeries,
} from "@/server/account";
import UsageChart from "@/components/UsageChart";
import ApiIcon from "@/components/ApiIcon";
import KeyManager from "@/components/KeyManager";
import { cancelSubscription } from "@/server/actions/subscribe";
import { compact } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Usage, subscriptions, and API keys for your Zephiel account.",
};
export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ subscribed?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?next=/dashboard");

  const { subscribed } = await searchParams;

  const [subs, keys, usage, recent, summary] = await Promise.all([
    getSubscriptions(user.id),
    getApiKeys(user.id),
    getUsageSeries(user.id),
    getRecentRequests(user.id),
    getAccountSummary(user.id),
  ]);

  const stats = [
    { label: "Calls this month", value: compact(summary.calls), sub: "Across all APIs" },
    {
      label: "Active subscriptions",
      value: String(subs.filter((s) => s.status === "active").length),
      sub: `${subs.length} total`,
    },
    { label: "Monthly spend", value: `$${summary.spend.toLocaleString()}`, sub: "From active plans" },
    { label: "Error rate", value: `${summary.errorRate.toFixed(2)}%`, sub: "This month" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">Dashboard</h1>
          <p className="mt-2 text-sm text-muted">
            Signed in as <span className="font-medium text-ink">{user.email}</span>
          </p>
        </div>
        <Link
          href="/marketplace"
          className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          Add an API
        </Link>
      </header>

      {subscribed && (
        <p className="mt-4 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm text-accent">
          Subscription activated. Your key can call it right away.
        </p>
      )}

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">{s.label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-ink">{s.value}</p>
            <p className="mt-1 text-xs text-muted">{s.sub}</p>
          </div>
        ))}
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-surface p-6">
        <UsageChart data={usage} />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-sm font-semibold tracking-tight text-ink">Subscriptions</h2>
            <Link href="/marketplace" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
              Browse APIs
            </Link>
          </div>

          {subs.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm font-medium text-ink">No subscriptions yet.</p>
              <p className="mt-1 text-sm text-muted">
                Every API has a free tier — subscribe to one to start making calls.
              </p>
              <Link
                href="/marketplace"
                className="mt-4 inline-block rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition hover:bg-elevated"
              >
                Find an API
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-line">
              {subs.map((s) => {
                const pct = s.quota === 0 ? 0 : Math.min(100, Math.round((s.used / s.quota) * 100));
                const hot = pct >= 80;
                const monthly = s.planPrice * (s.planUnit ? s.units : 1);
                return (
                  <div key={s.id} className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <ApiIcon api={{ logo: s.apiLogo, color: s.apiColor, icon: s.apiIcon }} size="sm" />
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/marketplace/${s.apiSlug}`}
                          className="truncate text-sm font-semibold text-ink hover:text-brand-600"
                        >
                          {s.apiName}
                        </Link>
                        <p className="text-xs text-muted">
                          {s.planName} plan
                          {s.planUnit && ` · ${s.units} ${s.planUnit}${s.units === 1 ? "" : "s"}`}
                          {s.status !== "active" && ` · ${s.status}`}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold text-ink">
                        {monthly === 0 ? "Free" : `$${monthly.toLocaleString()}/mo`}
                      </p>
                    </div>

                    <div className="mt-3 flex items-center gap-3">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-elevated">
                        <div
                          className={hot ? "h-full rounded-full bg-amber-500" : "h-full rounded-full bg-brand-500"}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="shrink-0 text-xs tabular-nums text-muted">
                        {s.used.toLocaleString()} / {s.quota.toLocaleString()}
                      </p>
                      {s.status === "active" && (
                        <form action={cancelSubscription} className="shrink-0">
                          <input type="hidden" name="id" value={s.id} />
                          <button className="text-xs font-medium text-muted transition hover:text-rose-600">
                            Cancel
                          </button>
                        </form>
                      )}
                    </div>

                    {hot && s.status === "active" && (
                      <p className="mt-2 text-xs font-medium text-amber-600">
                        {pct}% of quota used — upgrade before calls start failing.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-line bg-surface">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-sm font-semibold tracking-tight text-ink">Recent requests</h2>
          </div>

          {recent.length === 0 ? (
            <p className="px-5 py-8 text-sm text-muted">
              No calls yet. Use a key against{" "}
              <code className="rounded bg-elevated px-1.5 py-0.5 font-mono text-xs">/api/v1/&#123;slug&#125;</code> and
              they appear here.
            </p>
          ) : (
            <div className="divide-y divide-line">
              {recent.map((r, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  <span className="w-10 shrink-0 font-mono text-[10px] font-bold text-muted">{r.method}</span>
                  <code className="min-w-0 flex-1 truncate font-mono text-xs text-ink">{r.endpoint}</code>
                  <span
                    className={
                      r.status >= 400
                        ? "shrink-0 rounded-md bg-rose-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-rose-600"
                        : "shrink-0 rounded-md bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-600"
                    }
                  >
                    {r.status}
                  </span>
                  <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted">
                    {r.latency_ms}ms
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="mt-6">
        <KeyManager keys={keys} />
      </section>
    </div>
  );
}
