"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { generateTraffic, clearTraffic } from "@/server/traffic";
import { reconcileUsed } from "@/server/usage-maintenance";
import type { FormState } from "./admin";

const dateOnly = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Set a customer's registration date.
 *
 * Useful for correcting an imported account, and for seeding a realistic
 * demonstration account without dropping to psql.
 */
export async function setJoinDate(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const date = String(formData.get("joined") ?? "").trim();

  if (!id) return { error: "Missing account." };
  if (!dateOnly.test(date)) return { error: "Use a YYYY-MM-DD date." };
  if (new Date(`${date}T00:00:00Z`) > new Date()) {
    return { error: "A registration date cannot be in the future." };
  }

  await sql`UPDATE users SET created_at = ${`${date}T09:00:00Z`} WHERE id = ${id}`;

  revalidatePath(`/admin/users/${id}`);
  revalidatePath("/admin/users");
  return { ok: "Registration date updated." };
}

const subscriptionSchema = z.object({
  planId: z.string().min(1, "Choose a plan."),
  status: z.enum(["active", "pending", "cancelled", "expired"]),
  units: z.coerce.number().int().min(1).max(999),
  used: z.coerce.number().int().min(0),
});

/** Change a customer's plan, status, billable units, usage, or renewal date. */
export async function updateSubscription(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing subscription." };

  const parsed = subscriptionSchema.safeParse({
    planId: String(formData.get("planId") ?? ""),
    status: String(formData.get("status") ?? "active"),
    units: formData.get("units") || 1,
    used: formData.get("used") || 0,
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const ends = String(formData.get("ends") ?? "").trim();
  if (ends && !dateOnly.test(ends)) return { error: "Use a YYYY-MM-DD renewal date." };

  // The period start is stored, not inferred, so a backdated account can run a
  // first period from signup to a chosen renewal date.
  const starts = String(formData.get("starts") ?? "").trim();
  if (starts && !dateOnly.test(starts)) return { error: "Use a YYYY-MM-DD start date." };
  if (starts && ends && starts >= ends) {
    return { error: "The period must start before it renews." };
  }

  // The plan must belong to the same API as the subscription.
  const [plan] = await sql<{ id: string; quota: number }[]>`
    SELECT p.id, p.quota
    FROM plans p
    JOIN subscriptions s ON s.api_id = p.api_id
    WHERE p.id = ${parsed.data.planId} AND s.id = ${id}
    LIMIT 1
  `;
  if (!plan) return { error: "That plan does not belong to this API." };

  await sql`
    UPDATE subscriptions SET
      plan_id = ${plan.id},
      quota   = ${plan.quota},
      status  = ${parsed.data.status},
      units   = ${parsed.data.units},
      used    = ${parsed.data.used},
      current_period_start = ${starts ? `${starts}T00:00:00Z` : null},
      current_period_end = ${ends ? `${ends}T23:59:59Z` : null},
      updated_at = now()
    WHERE id = ${id}
  `;

  const [row] = await sql<{ user_id: string }[]>`
    SELECT user_id FROM subscriptions WHERE id = ${id} LIMIT 1
  `;

  // Moving the period changes which calls count against the allowance.
  await reconcileUsed(id);

  revalidatePath(`/admin/users/${row?.user_id ?? ""}`);
  revalidatePath("/admin/subscriptions");
  revalidatePath("/dashboard");
  return { ok: "Subscription updated." };
}

export async function deleteSubscription(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const [row] = await sql<{ user_id: string }[]>`
    SELECT user_id FROM subscriptions WHERE id = ${id} LIMIT 1
  `;

  await sql`DELETE FROM subscriptions WHERE id = ${id}`;

  revalidatePath(`/admin/users/${row?.user_id ?? ""}`);
  revalidatePath("/admin/subscriptions");
}

const trafficSchema = z.object({
  from: z.string().regex(dateOnly, "Use a YYYY-MM-DD start date."),
  total: z.coerce.number().int().min(1).max(1_000_000_000),
});

/**
 * Populate a demonstration account with a plausible traffic history.
 *
 * Writes daily rollups across the whole range plus real events for the last
 * few hours, then squares the subscription's `used` counter with the total so
 * the dashboard and the quota bar agree.
 */
export async function generateDemoTraffic(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const subscriptionId = String(formData.get("subscriptionId") ?? "");
  if (!subscriptionId) return { error: "Missing subscription." };

  const parsed = trafficSchema.safeParse({
    from: String(formData.get("from") ?? ""),
    total: formData.get("total") || 0,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const from = new Date(`${parsed.data.from}T00:00:00Z`);
  if (from > new Date()) return { error: "The start date cannot be in the future." };

  const [sub] = await sql<{ user_id: string; api_id: string; quota: number }[]>`
    SELECT user_id, api_id, quota FROM subscriptions WHERE id = ${subscriptionId} LIMIT 1
  `;
  if (!sub) return { error: "Subscription not found." };

  const result = await generateTraffic({
    userId: sub.user_id,
    apiId: sub.api_id,
    from,
    totalCalls: parsed.data.total,
  });

  // Derive the quota bar from the history just written, rather than from the
  // lifetime total. Setting used to every call ever generated made the bar
  // disagree with the usage chart, which only ever counts a window.
  await reconcileUsed(subscriptionId);

  revalidatePath(`/admin/users/${sub.user_id}`);
  revalidatePath("/dashboard");

  return {
    ok: `Generated ${result.totalCalls.toLocaleString()} calls across ${result.days} days (${result.rollupRows} daily rows, ${result.liveEvents} live events).`,
  };
}

/** Keep a demonstration account's charts advancing without manual regeneration. */
export async function setDemoTraffic(formData: FormData) {
  await requireAdmin();

  const subscriptionId = String(formData.get("subscriptionId") ?? "");
  const enabled = formData.get("enabled") === "on";
  if (!subscriptionId) return;

  const [sub] = await sql<{ user_id: string }[]>`
    UPDATE subscriptions SET demo_traffic = ${enabled}, updated_at = now()
    WHERE id = ${subscriptionId}
    RETURNING user_id
  `;

  revalidatePath(`/admin/users/${sub?.user_id ?? ""}`);
  revalidatePath("/dashboard/stores");
}

export async function clearDemoTraffic(formData: FormData) {
  await requireAdmin();
  const subscriptionId = String(formData.get("subscriptionId") ?? "");
  if (!subscriptionId) return;

  const [sub] = await sql<{ user_id: string; api_id: string }[]>`
    SELECT user_id, api_id FROM subscriptions WHERE id = ${subscriptionId} LIMIT 1
  `;
  if (!sub) return;

  await clearTraffic(sub.user_id, sub.api_id);
  await sql`UPDATE subscriptions SET used = 0 WHERE id = ${subscriptionId}`;

  revalidatePath(`/admin/users/${sub.user_id}`);
  revalidatePath("/dashboard");
}

/**
 * Recompute a subscription's quota counter from its recorded usage.
 *
 * The daily cron does this, but an operator looking at a bar that disagrees
 * with the charts should not have to wait a day to correct it.
 */
export async function reconcileUsage(formData: FormData): Promise<void> {
  await requireAdmin();

  const subscriptionId = String(formData.get("subscriptionId") ?? "");
  if (!subscriptionId) return;

  const [sub] = await sql<{ user_id: string }[]>`
    SELECT user_id FROM subscriptions WHERE id = ${subscriptionId} LIMIT 1
  `;
  if (!sub) return;

  await reconcileUsed(subscriptionId);

  revalidatePath(`/admin/users/${sub.user_id}`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/billing");
}

const historySchema = z.object({
  months: z.coerce.number().int().min(1).max(24),
  method: z.string().trim().max(40),
});

/**
 * Record past monthly payments for a subscription, with invoices.
 *
 * For demonstration accounts that need a plausible billing history. The
 * references are prefixed `demo_` rather than `zph_`, so these can never be
 * mistaken for — or reconciled against — a real Paystack transaction, while
 * the invoices themselves render exactly like live ones.
 */
export async function recordPastPayments(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const subscriptionId = String(formData.get("subscriptionId") ?? "");
  if (!subscriptionId) return { error: "Missing subscription." };

  const parsed = historySchema.safeParse({
    months: formData.get("months") || 3,
    method: String(formData.get("method") ?? "card"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const [sub] = await sql<
    { user_id: string; price: string; units: number; currency: string }[]
  >`
    SELECT s.user_id, p.price::text, s.units,
           COALESCE((SELECT value FROM settings WHERE key = 'paystack_currency'), 'NGN') AS currency
    FROM subscriptions s JOIN plans p ON p.id = s.plan_id
    WHERE s.id = ${subscriptionId} LIMIT 1
  `;
  if (!sub) return { error: "Subscription not found." };

  const monthly = Number(sub.price) * Math.max(1, sub.units);
  if (monthly <= 0) {
    return { error: "This subscription is on a free plan, so there is nothing to invoice." };
  }

  // Charged in the settlement currency, the same conversion checkout uses.
  const settings = await sql<{ key: string; value: string }[]>`
    SELECT key, value FROM settings WHERE key IN ('paystack_currency', 'usd_to_ngn')
  `;
  const currency = settings.find((r) => r.key === "paystack_currency")?.value ?? "NGN";
  const rate = Number(settings.find((r) => r.key === "usd_to_ngn")?.value ?? 1550);
  const amount = currency === "USD" ? monthly : Math.round(monthly * rate);

  let written = 0;
  for (let i = parsed.data.months; i >= 1; i--) {
    const reference = `demo_${randomBytes(9).toString("hex")}`;
    const rows = await sql<{ id: string }[]>`
      INSERT INTO payments (user_id, subscription_id, reference, amount, currency, status,
                            channel, paid_at, period_start, period_end, invoice_number)
      VALUES (
        ${sub.user_id}, ${subscriptionId}, ${reference}, ${amount}, ${currency}, 'success',
        ${parsed.data.method},
        (date_trunc('month', now()) - (${i}::text || ' months')::interval),
        (date_trunc('month', now()) - (${i}::text || ' months')::interval),
        (date_trunc('month', now()) - (${i - 1}::text || ' months')::interval),
        'ZPH-' || to_char(date_trunc('month', now()) - (${i}::text || ' months')::interval, 'YYYY')
          || '-' || lpad(nextval('invoice_number_seq')::text, 5, '0')
      )
      RETURNING id
    `;
    written += rows.length;
  }

  revalidatePath(`/admin/users/${sub.user_id}`);
  revalidatePath("/admin/payments");
  revalidatePath("/dashboard/billing");

  return {
    ok: `Recorded ${written} monthly ${written === 1 ? "payment" : "payments"} with invoices.`,
  };
}

const fillSchema = z.object({ percent: z.coerce.number().int().min(1).max(100) });

/**
 * Fill the current billing period's usage to a share of the allowance.
 *
 * Spread across the days elapsed so far, so the chart shows a plausible ramp
 * rather than one spike, and the quota bar lands where it was asked to.
 */
export async function fillPeriodUsage(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const subscriptionId = String(formData.get("subscriptionId") ?? "");
  if (!subscriptionId) return { error: "Missing subscription." };

  const parsed = fillSchema.safeParse({ percent: formData.get("percent") || 90 });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const [sub] = await sql<
    { user_id: string; api_id: string; quota: number; days: number }[]
  >`
    SELECT user_id, api_id, quota,
           GREATEST(1, (CURRENT_DATE - COALESCE(current_period_start, CURRENT_DATE - 30)::date))::int AS days
    FROM subscriptions WHERE id = ${subscriptionId} LIMIT 1
  `;
  if (!sub) return { error: "Subscription not found." };

  const [store] = await sql<{ id: string }[]>`
    SELECT id FROM stores WHERE subscription_id = ${subscriptionId} ORDER BY created_at LIMIT 1
  `;

  const target = Math.floor((sub.quota * parsed.data.percent) / 100);

  const [period] = await sql<{ start: Date }[]>`
    SELECT COALESCE(current_period_start, CURRENT_DATE - 30)::date AS start
    FROM subscriptions WHERE id = ${subscriptionId}
  `;

  // Days already finished in the period. Today is excluded because usage for
  // today lives in usage_events, which the reconciliation counts separately.
  const startDay = new Date(period.start);
  const today = new Date(new Date().toISOString().slice(0, 10));
  const days = Math.max(1, Math.round((today.getTime() - startDay.getTime()) / 86_400_000));

  // Shape first, then scale, so the weekday curve never pushes the total past
  // the target. Shaping inside the INSERT overshot by whatever the weights
  // averaged out to.
  const weights = Array.from({ length: days }, (_, i) => {
    const d = new Date(startDay.getTime() + i * 86_400_000);
    const weekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
    const ramp = 0.75 + (0.5 * i) / Math.max(1, days - 1);
    return (weekend ? 0.6 : 1.15) * ramp;
  });
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  let allocated = 0;
  const rows = weights.map((w, i) => {
    const isLast = i === weights.length - 1;
    // The last day takes the rounding remainder, so the sum is exact.
    const calls = isLast
      ? Math.max(0, target - allocated)
      : Math.max(0, Math.round((target * w) / totalWeight));
    allocated += calls;
    return {
      user_id: sub.user_id,
      api_id: sub.api_id,
      store_id: store?.id ?? null,
      day: new Date(startDay.getTime() + i * 86_400_000).toISOString().slice(0, 10),
      calls,
      errors: Math.round(calls * 0.002),
      avg_latency: 150,
    };
  });

  await sql`
    DELETE FROM usage_daily d USING subscriptions s
    WHERE s.id = ${subscriptionId} AND d.user_id = s.user_id AND d.api_id = s.api_id
      AND d.day >= COALESCE(s.current_period_start, CURRENT_DATE - 30)::date
  `;

  for (let i = 0; i < rows.length; i += 200) {
    await sql`INSERT INTO usage_daily ${sql(rows.slice(i, i + 200))}`;
  }

  await reconcileUsed(subscriptionId);

  const [after] = await sql<{ used: number; quota: number }[]>`
    SELECT used, quota FROM subscriptions WHERE id = ${subscriptionId}
  `;

  revalidatePath(`/admin/users/${sub.user_id}`);
  revalidatePath("/dashboard");

  return {
    ok: `Usage set to ${after.used.toLocaleString()} of ${after.quota.toLocaleString()} calls (${Math.round(
      (after.used / after.quota) * 100
    )}% of the allowance).`,
  };
}
