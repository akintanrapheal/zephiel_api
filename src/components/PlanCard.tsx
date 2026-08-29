import Link from "next/link";
import type { Plan } from "@/lib/types";
import { cn } from "@/lib/utils";
import { subscribe } from "@/server/actions/subscribe";
import {
  isContactSales,
  priceFor,
  formatPrice,
  intervalSuffix,
  ANNUAL_DISCOUNT_PERCENT,
  type BillingInterval,
} from "@/lib/plans";

export default function PlanCard({
  plan,
  apiSlug,
  currentPlan,
  interval = "monthly",
  href,
}: {
  plan: Plan;
  /** When supplied the card becomes actionable and can be subscribed to. */
  apiSlug?: string;
  currentPlan?: string | null;
  interval?: BillingInterval;
  /** Where a non-actionable card should send the visitor instead. */
  href?: string;
}) {
  const isCurrent = currentPlan != null && currentPlan === plan.name;
  const quoted = isContactSales(plan.name);
  const actionable = Boolean(apiSlug && plan.id) && !quoted;

  const periodPrice = priceFor(plan.price, interval);
  const isFree = plan.price === 0 && !quoted;

  const label = isCurrent
    ? "Current plan"
    : quoted
      ? "Contact sales"
      : isFree
        ? "Start free"
        : "Subscribe";

  // A quoted plan never shows a number, whatever its stored price: it is not
  // buyable at that figure, so printing it alongside "Contact sales" invites
  // exactly the confusion it caused on the dashboard.
  const priceLabel = quoted ? "Custom" : isFree ? "Free" : formatPrice(periodPrice);

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border p-6",
        plan.popular ? "border-brand-500 bg-surface shadow-lift" : "border-line bg-surface"
      )}
    >
      {plan.popular && (
        <span className="absolute -top-2.5 left-6 rounded-full bg-brand-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
          Most popular
        </span>
      )}

      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">{plan.name}</h3>
      <p className="mt-3 flex items-baseline gap-1">
        <span className="text-3xl font-semibold tracking-tight text-ink">{priceLabel}</span>
        {!quoted && periodPrice > 0 && (
          <span className="text-sm text-muted">{intervalSuffix(interval, plan.unit)}</span>
        )}
      </p>

      {!quoted && periodPrice > 0 && interval === "annual" && (
        <p className="mt-1 text-xs text-accent">
          {formatPrice(plan.price)}
          {plan.unit ? `/${plan.unit}` : ""}/mo billed annually &middot; {ANNUAL_DISCOUNT_PERCENT}% off
        </p>
      )}

      <p className="mt-3 text-sm font-medium text-ink">{plan.requests}</p>
      <p className="text-xs text-muted">{plan.rateLimit}</p>

      <ul className="mt-5 flex-1 space-y-2.5">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm text-muted">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="mt-1 h-3.5 w-3.5 shrink-0 text-accent">
              <path d="M4 12.5l5 5L20 6.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {f}
          </li>
        ))}
      </ul>

      {actionable ? (
        <form action={subscribe} className="mt-6 space-y-3">
          <input type="hidden" name="planId" value={plan.id} />
          <input type="hidden" name="apiSlug" value={apiSlug} />
          <input type="hidden" name="interval" value={interval} />

          {plan.unit && plan.price > 0 && (
            <label className="block">
              <span className="text-xs font-medium text-muted">
                How many {plan.unit}s?
              </span>
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

          <button
            type="submit"
            disabled={isCurrent}
            className={cn(
              "w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60",
              plan.popular
                ? "bg-brand-600 text-white hover:bg-brand-700"
                : "border border-line text-ink hover:bg-elevated"
            )}
          >
            {label}
          </button>
        </form>
      ) : isCurrent ? (
        <p className="mt-6 rounded-xl border border-line px-4 py-2.5 text-center text-sm font-semibold text-muted">
          {label}
        </p>
      ) : (
        // Previously an inert <button>: every card here rendered a CTA that did
        // nothing at all, including all four on the pricing page.
        <Link
          href={quoted ? `/contact?plan=${encodeURIComponent(plan.name.toLowerCase())}` : (href ?? "/signup")}
          className={cn(
            "mt-6 rounded-xl px-4 py-2.5 text-center text-sm font-semibold transition",
            plan.popular
              ? "bg-brand-600 text-white hover:bg-brand-700"
              : "border border-line text-ink hover:bg-elevated"
          )}
        >
          {label}
        </Link>
      )}
    </div>
  );
}
