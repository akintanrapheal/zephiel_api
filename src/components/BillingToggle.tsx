"use client";

import { ANNUAL_DISCOUNT_PERCENT, type BillingInterval } from "@/lib/plans";
import { cn } from "@/lib/utils";

export default function BillingToggle({
  value,
  onChange,
  className,
}: {
  value: BillingInterval;
  onChange: (v: BillingInterval) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-3", className)}>
      <div
        role="radiogroup"
        aria-label="Billing period"
        className="inline-flex rounded-xl border border-line bg-surface p-1"
      >
        {(["monthly", "annual"] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={value === option}
            onClick={() => onChange(option)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium capitalize transition",
              value === option
                ? "bg-brand-600 text-white"
                : "text-muted hover:text-ink"
            )}
          >
            {option}
          </button>
        ))}
      </div>

      <span
        className={cn(
          "rounded-full px-2.5 py-1 text-xs font-semibold transition",
          value === "annual"
            ? "bg-accent/10 text-accent"
            : "text-muted"
        )}
      >
        Save {ANNUAL_DISCOUNT_PERCENT}% — two months free
      </span>
    </div>
  );
}
