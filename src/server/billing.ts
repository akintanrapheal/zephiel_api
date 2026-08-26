import "server-only";
import type { JSONValue } from "postgres";
import { sql } from "@/lib/db";
import { verifyTransaction } from "@/lib/paystack";

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
    { id: string; status: string; subscription_id: string | null; user_id: string | null }[]
  >`
    SELECT id, status, subscription_id, user_id
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

  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  await sql.begin(async (tx) => {
    await tx`
      UPDATE payments SET
        status   = 'success',
        amount   = ${verified.amount / 100},
        currency = ${verified.currency},
        channel  = ${verified.channel},
        paid_at  = ${verified.paidAt ?? new Date()},
        raw      = ${tx.json(verified.raw as JSONValue)}
      WHERE id = ${payment.id}
    `;

    if (payment.subscription_id) {
      await tx`
        UPDATE subscriptions SET
          status = 'active',
          used = 0,
          current_period_end = ${periodEnd},
          updated_at = now()
        WHERE id = ${payment.subscription_id}
      `;
    }
  });

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
