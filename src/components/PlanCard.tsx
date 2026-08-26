import type { Plan } from "@/lib/types";
import { cn, money } from "@/lib/utils";
import { subscribe } from "@/server/actions/subscribe";

export default function PlanCard({
  plan,
  apiSlug,
  currentPlan,
}: {
  plan: Plan;
  /** When supplied the card becomes actionable and can be subscribed to. */
  apiSlug?: string;
  currentPlan?: string | null;
}) {
  const isCurrent = currentPlan != null && currentPlan === plan.name;
  const isEnterprise = plan.name === "Enterprise";
  const actionable = Boolean(apiSlug && plan.id) && !isEnterprise;

  const label = isCurrent
    ? "Current plan"
    : isEnterprise
      ? "Contact sales"
      : plan.price === 0
        ? "Start free"
        : "Subscribe";

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
        <span className="text-3xl font-semibold tracking-tight text-ink">
          {isEnterprise && plan.price === 0 ? "Custom" : money(plan.price)}
        </span>
        {plan.price > 0 && (
          <span className="text-sm text-muted">{plan.unit ? `/${plan.unit}/mo` : "/mo"}</span>
        )}
      </p>

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
      ) : (
        <button
          disabled={isCurrent}
          className={cn(
            "mt-6 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60",
            plan.popular
              ? "bg-brand-600 text-white hover:bg-brand-700"
              : "border border-line text-ink hover:bg-elevated"
          )}
        >
          {label}
        </button>
      )}
    </div>
  );
}
