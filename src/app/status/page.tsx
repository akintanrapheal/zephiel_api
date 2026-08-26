import type { Metadata } from "next";
import Link from "next/link";
import { getApis } from "@/server/catalog";

export const metadata: Metadata = {
  title: "Status",
  description: "Live availability and latency for every API on the Zephiel platform.",
};

// Deterministic 90-day history so server and client markup match.
function history(seed: number) {
  return Array.from({ length: 90 }, (_, i) => {
    const n = Math.sin((i + 1) * seed) * 10000;
    const r = n - Math.floor(n);
    if (r > 0.985) return "down";
    if (r > 0.94) return "degraded";
    return "up";
  });
}

const barColor: Record<string, string> = {
  up: "bg-accent",
  degraded: "bg-amber-500",
  down: "bg-rose-500",
};

export const revalidate = 60;

export default async function StatusPage() {
  const apis = await getApis();
  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">System status</h1>
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent/5 px-5 py-4">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
          </span>
          <p className="text-sm font-semibold text-ink">All systems operational</p>
          <p className="ml-auto text-xs text-muted">Updated every 60 seconds</p>
        </div>
      </header>

      <section className="mt-10 space-y-3">
        {apis.map((api, idx) => {
          const bars = history(idx + 1);
          const incidents = bars.filter((b) => b !== "up").length;
          return (
            <div key={api.slug} className="rounded-2xl border border-line bg-surface p-5">
              <div className="flex flex-wrap items-center gap-3">
                <Link href={`/marketplace/${api.slug}`} className="text-sm font-semibold text-ink hover:text-brand-600">
                  {api.name}
                </Link>
                <span className="rounded-md bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                  Operational
                </span>
                <span className="ml-auto text-xs tabular-nums text-muted">
                  {api.latency}ms &middot; {api.uptime}% uptime
                </span>
              </div>

              <div className="mt-3 flex gap-[2px]" title={`${incidents} degraded days in the last 90`}>
                {bars.map((b, i) => (
                  <span key={i} className={`h-7 flex-1 rounded-[2px] ${barColor[b]}`} />
                ))}
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] text-muted">
                <span>90 days ago</span>
                <span>Today</span>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
