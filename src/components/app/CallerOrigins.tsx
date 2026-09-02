import type { CallerOrigin } from "@/server/account";

/**
 * Where recent calls came from.
 *
 * Answers a question the charts cannot: whether traffic is arriving from a real
 * application, and which one. Demonstration traffic is labelled as such rather
 * than hidden, so a chart with shape in it is never mistaken for live use.
 */
export default function CallerOrigins({ origins }: { origins: CallerOrigin[] }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="text-sm font-semibold tracking-tight text-ink">Where calls came from</h2>
      <p className="mt-0.5 text-xs text-muted">Last 48 hours, by calling host.</p>

      {origins.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
          No calls in the last 48 hours.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-line">
          {origins.map((o) => (
            <li key={`${o.origin ?? "none"}-${o.source}`} className="flex flex-wrap items-center gap-3 py-3">
              <span className="font-mono text-xs text-ink">
                {o.origin ?? "unattributed"}
              </span>

              {o.source === "demo" ? (
                <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600">
                  Demo
                </span>
              ) : (
                <span className="rounded-md bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
                  Live
                </span>
              )}

              <span className="ml-auto text-xs text-muted">
                last{" "}
                {new Date(o.lastCall).toLocaleString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                  day: "numeric",
                  month: "short",
                })}
              </span>
              <span className="w-20 text-right text-sm font-semibold tabular-nums text-ink">
                {o.calls.toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs leading-6 text-muted">
        A host appears here once one of your keys calls the gateway from it. Server-to-server callers
        that send no Origin or Referer header show as{" "}
        <span className="font-mono">unattributed</span>.
      </p>
    </section>
  );
}
