import type { Plan } from "@/data/apis";
import { cn, money } from "@/lib/utils";

export default function PlanCard({ plan }: { plan: Plan }) {
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
        <span className="text-3xl font-semibold tracking-tight text-ink">{money(plan.price)}</span>
        {plan.price > 0 && <span className="text-sm text-muted">/mo</span>}
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

      <button
        className={cn(
          "mt-6 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
          plan.popular
            ? "bg-brand-600 text-white hover:bg-brand-700"
            : "border border-line text-ink hover:bg-elevated"
        )}
      >
        {plan.price === 0 ? "Start free" : plan.name === "Enterprise" ? "Contact sales" : "Subscribe"}
      </button>
    </div>
  );
}
