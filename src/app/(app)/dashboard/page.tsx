import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getAccountSummary, getRecentRequests, getSubscriptions } from "@/server/account";
import SubscriptionList from "@/components/app/SubscriptionList";
import { compact } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Overview" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ subscribed?: string }>;
}) {
  const user = await requireUser();
  const { subscribed } = await searchParams;

  const [subs, recent, summary] = await Promise.all([
    getSubscriptions(user.id),
    getRecentRequests(user.id, 6),
    getAccountSummary(user.id),
  ]);

  const active = subs.filter((s) => s.status === "active");
  const memberSince = new Date(user.createdAt).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  const tiles = [
    { label: "Calls this month", value: compact(summary.calls), sub: "Across all APIs" },
    { label: "Active subscriptions", value: String(active.length), sub: `${subs.length} total` },
    { label: "Monthly spend", value: `$${summary.spend.toLocaleString()}`, sub: "From active plans" },
    { label: "Error rate", value: `${summary.errorRate.toFixed(2)}%`, sub: "This month" },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {user.name ? `Welcome back, ${user.name.split(" ")[0]}` : "Dashboard"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {user.email} &middot; member since {memberSince}
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
        <p className="rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm text-accent">
          Subscription activated — your key can call it right away.
        </p>
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

      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold tracking-tight text-ink">Your subscriptions</h2>
          <Link href="/dashboard/usage" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
            View usage
          </Link>
        </div>
        <SubscriptionList subs={subs} />
      </section>

      <section className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 className="text-sm font-semibold tracking-tight text-ink">Recent requests</h2>
          <Link href="/dashboard/playground" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
            Try an endpoint
          </Link>
        </div>

        {recent.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">
            No calls yet. The{" "}
            <Link href="/dashboard/playground" className="font-medium text-brand-600 hover:underline">
              playground
            </Link>{" "}
            is the quickest way to make your first one.
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
  );
}
