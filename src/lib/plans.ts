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

/**
 * How many storefronts a plan may connect.
 *
 * Free plans get a small allowance; paid Multistore plans are billed per
 * store, so the ceiling there is a sanity limit rather than a product one.
 * This was previously a flat 100 for everyone, which meant a free account
 * could connect a hundred stores and accrue a hundred billable units.
 */
/** Used when a plan predates the store_limit column. */
export const DEFAULT_FREE_STORE_LIMIT = 1;
export const DEFAULT_PAID_STORE_LIMIT = 3;

/**
 * Storefronts a plan allows.
 *
 * Reads the plan's own allowance so tiers can differ; 0 means negotiated
 * rather than fixed, which is Enterprise. Falls back to a price-based guess
 * only for rows written before plans carried the column.
 */
export function storeLimitFor(planPrice: number, storeLimit?: number | null): number {
  if (storeLimit === 0) return Number.POSITIVE_INFINITY;
  if (typeof storeLimit === "number" && storeLimit > 0) return storeLimit;
  return planPrice === 0 ? DEFAULT_FREE_STORE_LIMIT : DEFAULT_PAID_STORE_LIMIT;
}
