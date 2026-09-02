import Link from "next/link";
import type { Plan } from "@/lib/types";
import { cn, money } from "@/lib/utils";
import { subscribe } from "@/server/actions/subscribe";
import { isContactSales, priceFor, type BillingInterval } from "@/lib/plans";

/**
 * Every capability offered across a set of plans, in tier order.
 *
 * Tiers are cumulative, so the longest list contains the rest; anything a
 * shorter list adds is appended rather than dropped, in case a plan edited in
 * the console breaks that assumption.
 */
export function planFeatureMatrix(plans: Plan[]): string[] {
  const ordered = [...plans].sort((a, b) => b.features.length - a.features.length);
  const seen = new Set<string>();
  const out: string[] = [];

  for (const plan of ordered) {
    for (const f of plan.features) {
      if (!seen.has(f)) {
        seen.add(f);
        out.push(f);
      }
    }
  }
  return out;
}

export default function PlanCard({
  plan,
  apiSlug,
  currentPlan,
  interval = "monthly",
  /**
   * Every capability across the whole set. Supplied, the card shows all of
   * them with a tick or a cross so tiers can be compared row by row; omitted,
   * it lists only what this plan includes.
   */
  matrix,
  /** Where a non-purchasable card leads. Defaults to signup. */
  href,
}: {
  plan: Plan;
  apiSlug?: string;
  currentPlan?: string | null;
  interval?: BillingInterval;
  matrix?: string[];
  href?: string;
}) {
  const isCurrent = currentPlan != null && currentPlan === plan.name;
  const quoted = isContactSales(plan.name);
  const actionable = Boolean(apiSlug && plan.id) && !quoted;

  const charged = priceFor(plan.price, interval);
  const included = new Set(plan.features);
  const rows = matrix ?? plan.features;

  const label = isCurrent
    ? "Current plan"
    : quoted
      ? "Contact sales"
      : plan.price === 0
        ? "Start free"
        : "Subscribe now";

  const buttonClass = cn(
    "w-full rounded-xl px-4 py-3 text-sm font-semibold transition disabled:opacity-60",
    plan.popular
      ? "bg-brand-600 text-white hover:bg-brand-700"
      : "border border-line bg-surface text-ink hover:bg-elevated"
  );

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border bg-surface",
        plan.popular ? "border-brand-500 shadow-lift" : "border-line"
      )}
    >
      {plan.popular && (
        <p className="rounded-t-2xl bg-brand-600 py-1.5 text-center text-[10px] font-bold uppercase tracking-widest text-white">
          Most popular
        </p>
      )}

      <div className={cn("flex flex-1 flex-col p-6", plan.popular ? "pt-5" : "")}>
        <h3 className="text-base font-semibold tracking-tight text-ink">{plan.name}</h3>

        {/* The allowance leads, the way a developer compares plans. */}
        <p className="mt-3 text-lg font-semibold tracking-tight text-brand-600">{plan.requests}</p>
        <p className="text-xs text-muted">{plan.rateLimit}</p>

        <p className="mt-3 flex items-baseline gap-1">
          <span className="text-2xl font-semibold tracking-tight text-ink">
            {quoted && plan.price === 0 ? "Custom" : money(charged)}
          </span>
          {plan.price > 0 && (
            <span className="text-sm text-muted">
              {plan.unit ? `/${plan.unit}` : ""}
              {interval === "annual" ? "/year" : "/month"}
            </span>
          )}
        </p>

        {plan.price > 0 && interval === "annual" && (
          <p className="mt-1 text-xs font-medium text-accent">
            {money(plan.price)}
            {plan.unit ? `/${plan.unit}` : ""}/month, billed yearly
          </p>
        )}

        <div className="mt-5">
          {actionable ? (
            <form action={subscribe} className="space-y-3">
              <input type="hidden" name="planId" value={plan.id} />
              <input type="hidden" name="apiSlug" value={apiSlug} />
              <input type="hidden" name="interval" value={interval} />

              {plan.unit && plan.price > 0 && (
                <label className="block text-left">
                  <span className="text-xs font-medium text-muted">How many {plan.unit}s?</span>
                  <input
                    type="number"
                    name="units"
                    min={1}
                    max={999}
                    defaultValue={1}
                    className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-brand-400"
                  />
                </label>
              )}

              <button type="submit" disabled={isCurrent} className={buttonClass}>
                {label}
              </button>
            </form>
          ) : quoted ? (
            <Link
              href={`/contact?plan=enterprise${apiSlug ? `&api=${apiSlug}` : ""}`}
              className={cn(buttonClass, "block text-center")}
            >
              {label}
            </Link>
          ) : (
            <Link href={href ?? "/signup"} className={cn(buttonClass, "block text-center")}>
              {label}
            </Link>
          )}
        </div>

        <ul className="mt-6 space-y-2.5">
          {rows.map((f) => {
            const has = included.has(f);
            return (
              <li
                key={f}
                className={cn("flex items-start gap-2.5 text-sm", has ? "text-muted" : "text-muted/55")}
              >
                {has ? (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    aria-hidden
                    className="mt-1 h-3.5 w-3.5 shrink-0 text-accent"
                  >
                    <path d="M4 12.5l5 5L20 6.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    aria-hidden
                    className="mt-1 h-3.5 w-3.5 shrink-0 text-rose-500/70"
                  >
                    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                  </svg>
                )}
                <span className={has ? "" : "line-through decoration-1"}>{f}</span>
                <span className="sr-only">{has ? " — included" : " — not included"}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
