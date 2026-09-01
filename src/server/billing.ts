import "server-only";
import type { JSONValue } from "postgres";
import { sql } from "@/lib/db";
import { isBillingInterval, periodEndFor } from "@/lib/plans";
import { verifyTransaction } from "@/lib/paystack";
import { ensureInvoiceNumber, sendReceiptEmail } from "@/server/invoices";

export type ActivationResult =
  | { ok: true; apiSlug: string | null; alreadyProcessed: boolean }
  | { ok: false; reason: string };

/**
 * Confirms a payment with Paystack and activates its subscription.
 *
 * Called from both the browser callback and the webhook, which can arrive in
 * either order or both — so it is idempotent: a payment already marked success
 * short-circuits instead of extending the period a second time.
 */
export async function activateFromReference(reference: string): Promise<ActivationResult> {
  const [payment] = await sql<
    {
      id: string; status: string; subscription_id: string | null; user_id: string | null;
      plan_id: string | null; units: number; billing_interval: string; amount: string;
    }[]
  >`
    SELECT id, status, subscription_id, user_id, plan_id, units, billing_interval, amount
    FROM payments WHERE reference = ${reference} LIMIT 1
  `;

  if (!payment) return { ok: false, reason: "Unknown payment reference." };

  if (payment.status === "success") {
    const slug = await slugForSubscription(payment.subscription_id);
    return { ok: true, apiSlug: slug, alreadyProcessed: true };
  }

  let verified;
  try {
    verified = await verifyTransaction(reference);
  } catch (err) {
    console.error("Paystack verify failed:", err);
    return { ok: false, reason: "Could not reach Paystack to verify this payment." };
  }

  if (verified.status !== "success") {
    await sql`
      UPDATE payments
      SET status = ${verified.status}, raw = ${sql.json(verified.raw as JSONValue)}
      WHERE id = ${payment.id}
    `;
    return { ok: false, reason: `Payment was not completed (${verified.status}).` };
  }

  // What Paystack collected must match what we asked for. The amount is set
  // server-side at initialize, so a mismatch means something is wrong rather
  // than merely unexpected, and activating on it would be granting a plan that
  // was not paid for.
  const expected = Number(payment.amount);
  const collected = verified.amount / 100;
  if (Math.abs(expected - collected) > 0.009) {
    console.error(`Payment ${reference}: expected ${expected}, Paystack reports ${collected}.`);
    return { ok: false, reason: "The amount paid does not match this order." };
  }

  // The period paid for follows the interval the payment was taken on; this
  // used to add a month unconditionally, so an annual payment bought one month.
  const interval = isBillingInterval(payment.billing_interval) ? payment.billing_interval : "monthly";
  const periodEnd = periodEndFor(interval);

  // The plan the customer paid for, with the allowance it carries.
  const [paidPlan] = payment.plan_id
    ? await sql<{ id: string; quota: number }[]>`
        SELECT id, quota FROM plans WHERE id = ${payment.plan_id} LIMIT 1
      `
    : [];

  await sql.begin(async (tx) => {
    // Claims the row: the browser callback and the webhook can arrive at the
    // same moment, and both previously passed the status check above before
    // either had written anything.
    const claimed = await tx<{ id: string }[]>`
      UPDATE payments SET status = 'success' WHERE id = ${payment.id} AND status <> 'success'
      RETURNING id
    `;
    if (claimed.length === 0) return;

    // The period is stored on the payment so the receipt states what was
    // bought, and keeps saying so after the subscription renews past it.
    await tx`
      UPDATE payments SET
        status       = 'success',
        amount       = ${verified.amount / 100},
        currency     = ${verified.currency},
        channel      = ${verified.channel},
        paid_at      = ${verified.paidAt ?? new Date()},
        period_start = now(),
        period_end   = ${periodEnd},
        raw          = ${tx.json(verified.raw as JSONValue)}
      WHERE id = ${payment.id}
    `;

    if (payment.subscription_id) {
      // The upgrade is applied here rather than at checkout, so the customer
      // keeps the plan they already paid for until this point.
      if (paidPlan) {
        await tx`
          UPDATE subscriptions SET
            status = 'active', used = 0,
            plan_id = ${paidPlan.id}, quota = ${paidPlan.quota},
            units = ${payment.units}, billing_interval = ${interval},
            current_period_end = ${periodEnd}, updated_at = now()
          WHERE id = ${payment.subscription_id}
        `;
      } else {
        // Older payment rows predate plan_id; activate without moving the plan.
        await tx`
          UPDATE subscriptions SET
            status = 'active', used = 0,
            billing_interval = ${interval},
            current_period_end = ${periodEnd}, updated_at = now()
          WHERE id = ${payment.subscription_id}
        `;
      }
    }
  });

  // Outside the transaction: the receipt is a side effect, and a mail provider
  // being slow or down must not roll back a payment that has been taken.
  // sendReceiptEmail claims receipt_sent_at itself, so the callback and the
  // webhook cannot both send one.
  try {
    await ensureInvoiceNumber(payment.id);
    const receipt = await sendReceiptEmail(reference);
    if (!receipt.sent && receipt.reason !== "Already sent, or payment is not successful.") {
      console.warn(`Receipt not sent for ${reference}: ${receipt.reason}`);
    }
  } catch (err) {
    console.error("Receipt send failed:", reference, err);
  }

  return {
    ok: true,
    apiSlug: await slugForSubscription(payment.subscription_id),
    alreadyProcessed: false,
  };
}

async function slugForSubscription(subscriptionId: string | null) {
  if (!subscriptionId) return null;
  const [row] = await sql<{ slug: string }[]>`
    SELECT a.slug FROM subscriptions s
    JOIN apis a ON a.id = s.api_id
    WHERE s.id = ${subscriptionId} LIMIT 1
  `;
  return row?.slug ?? null;
}
