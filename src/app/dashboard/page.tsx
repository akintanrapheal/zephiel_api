import type { Metadata } from "next";
import Link from "next/link";
import { apis } from "@/data/apis";
import UsageChart, { type UsagePoint } from "@/components/UsageChart";
import ApiKeyRow from "@/components/ApiKeyRow";
import { compact } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Usage, subscriptions, and API keys for your Zephiel account.",
};

// Deterministic sample series so the server and client render the same markup.
function buildUsage(): UsagePoint[] {
  const out: UsagePoint[] = [];
  const start = new Date("2026-07-28T00:00:00Z");
  for (let i = 0; i < 30; i++) {
    const d = new Date(start.getTime() + i * 86_400_000);
    const weekday = d.getUTCDay();
    const weekendDip = weekday === 0 || weekday === 6 ? 0.45 : 1;
    const trend = 1 + i * 0.021;
    const wobble = 1 + Math.sin(i * 1.7) * 0.16 + Math.cos(i * 0.9) * 0.09;
    out.push({
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
      calls: Math.round(9800 * weekendDip * trend * wobble),
    });
  }
  return out;
}

const subscriptions = [
  { slug: "exchange-rates-data", plan: "Pro", used: 182_400, quota: 250_000, cost: 48 },
  { slug: "ip-intelligence", plan: "Starter", used: 7_910, quota: 10_000, cost: 9 },
  { slug: "email-verification", plan: "Starter", used: 4_120, quota: 10_000, cost: 15 },
  { slug: "weather-forecast", plan: "Free", used: 88, quota: 100, cost: 0 },
];

const keys = [
  { label: "Production", scope: "All APIs", created: "Created Mar 4, 2026", secret: "zk_live_8f31ba92c47de015aa73" },
  { label: "Staging", scope: "All APIs", created: "Created Mar 4, 2026", secret: "zk_test_2b90ce74af11d3e6bb42" },
  { label: "Analytics job", scope: "Read-only", created: "Created Jun 19, 2026", secret: "zk_live_5da2f8103ec9b7462fa1" },
];

export default function DashboardPage() {
  const usage = buildUsage();
  const total = usage.reduce((s, d) => s + d.calls, 0);
  const monthlyCost = subscriptions.reduce((s, x) => s + x.cost, 0);

  const stats = [
    { label: "Calls this month", value: compact(total), sub: "+18% vs last month" },
    { label: "Active subscriptions", value: String(subscriptions.length), sub: `of ${apis.length} APIs` },
    { label: "Monthly spend", value: `$${monthlyCost}`, sub: "Next invoice Sep 1" },
    { label: "Error rate", value: "0.12%", sub: "Well under budget" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">Dashboard</h1>
          <p className="mt-2 text-sm text-muted">Usage, subscriptions, and keys across every API you use.</p>
        </div>
        <Link
          href="/marketplace"
          className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          Add an API
        </Link>
      </header>

      <div className="mt-4 rounded-xl border border-brand-500/25 bg-brand-500/5 px-4 py-3 text-sm text-muted">
        This dashboard renders sample data. Wire it to your own billing and metering backend to make it live.
      </div>

      {/* Stat tiles — hero numbers, no chart needed */}
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
        {/* Subscriptions */}
        <section className="rounded-2xl border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-sm font-semibold tracking-tight text-ink">Subscriptions</h2>
            <Link href="/pricing" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
              Manage plans
            </Link>
          </div>

          <div className="divide-y divide-line">
            {subscriptions.map((s) => {
              const api = apis.find((a) => a.slug === s.slug)!;
              const pct = Math.min(100, Math.round((s.used / s.quota) * 100));
              const hot = pct >= 80;
              return (
                <div key={s.slug} className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[11px] font-bold text-white"
                      style={{ background: `linear-gradient(135deg, ${api.color}, ${api.color}bb)` }}
                    >
                      {api.logo}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link href={`/marketplace/${api.slug}`} className="truncate text-sm font-semibold text-ink hover:text-brand-600">
                        {api.name}
                      </Link>
                      <p className="text-xs text-muted">{s.plan} plan</p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-ink">
                      {s.cost === 0 ? "Free" : `$${s.cost}/mo`}
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
                  </div>
                  {hot && (
                    <p className="mt-2 text-xs font-medium text-amber-600">
                      {pct}% of quota used — consider upgrading before overage applies.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Recent requests */}
        <section className="rounded-2xl border border-line bg-surface">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-sm font-semibold tracking-tight text-ink">Recent requests</h2>
          </div>
          <div className="divide-y divide-line">
            {[
              { m: "GET", p: "/exchange-rates-data/latest", s: 200, ms: 78 },
              { m: "GET", p: "/ip-intelligence/lookup/41.58.x.x", s: 200, ms: 39 },
              { m: "POST", p: "/email-verification/bulk", s: 202, ms: 141 },
              { m: "GET", p: "/weather-forecast/current", s: 200, ms: 64 },
              { m: "GET", p: "/exchange-rates-data/convert", s: 429, ms: 12 },
              { m: "GET", p: "/ip-intelligence/threat/8.8.8.8", s: 200, ms: 44 },
            ].map((r, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <span className="w-10 shrink-0 font-mono text-[10px] font-bold text-muted">{r.m}</span>
                <code className="min-w-0 flex-1 truncate font-mono text-xs text-ink">{r.p}</code>
                <span
                  className={
                    r.s >= 400
                      ? "shrink-0 rounded-md bg-rose-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-rose-600"
                      : "shrink-0 rounded-md bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-600"
                  }
                >
                  {r.s}
                </span>
                <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted">{r.ms}ms</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Keys */}
      <section className="mt-6 rounded-2xl border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-ink">API keys</h2>
            <p className="mt-0.5 text-xs text-muted">One key authenticates every API on the platform.</p>
          </div>
          <button className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-elevated">
            Create key
          </button>
        </div>
        {keys.map((k) => (
          <ApiKeyRow key={k.label} {...k} />
        ))}
      </section>
    </div>
  );
}
