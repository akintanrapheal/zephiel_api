/**
 * Plan pricing rules shared by every surface that shows or sells a plan.
 *
 * These lived inline in PlanCard, which meant PlanChooser — the dashboard
 * upgrade flow — did not have them. Enterprise rendered there as an ordinary
 * purchasable tier: "Free" with a "Switch to Free" button where its price was
 * 0, and a charge at list price everywhere else.
 */

export type BillingInterval = "monthly" | "annual";

export const BILLING_INTERVALS: BillingInterval[] = ["monthly", "annual"];

/** Annual plans are charged for ten months, so two are free. */
export const ANNUAL_MONTHS_CHARGED = 10;

export const ANNUAL_DISCOUNT_PERCENT = Math.round(
  (1 - ANNUAL_MONTHS_CHARGED / 12) * 100
);

export function isBillingInterval(v: unknown): v is BillingInterval {
  return v === "monthly" || v === "annual";
}

/**
 * Plans quoted rather than sold. They carry a "Custom" price, are never
 * actionable in the UI, and are refused server-side in subscribe().
 */
export function isContactSales(planName: string) {
  return planName.trim().toLowerCase() === "enterprise";
}

/** What one billing period costs, before multiplying by units. */
export function priceFor(monthlyPrice: number, interval: BillingInterval) {
  return interval === "annual" ? monthlyPrice * ANNUAL_MONTHS_CHARGED : monthlyPrice;
}

/** The end of the period being paid for, from now. */
export function periodEndFor(interval: BillingInterval, from = new Date()) {
  const d = new Date(from);
  if (interval === "annual") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

export function intervalSuffix(interval: BillingInterval, unit?: string | null) {
  const period = interval === "annual" ? "yr" : "mo";
  return unit ? `/${unit}/${period}` : `/${period}`;
}

/** "$1,490" — plain, so callers can place the suffix themselves. */
export function formatPrice(amount: number) {
  return `$${amount.toLocaleString()}`;
}
