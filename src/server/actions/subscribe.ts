"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { initializeTransaction, isConfigured, toSubunits, PAYSTACK_CURRENCY } from "@/lib/paystack";
import { appUrl } from "@/lib/app-url";

function periodEnd() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d;
}

/**
 * Free plans activate immediately. Paid plans create a pending subscription and
 * a payment row, then hand off to Paystack; activation happens on verify or on
 * the webhook, whichever arrives first.
 */
export async function subscribe(formData: FormData) {
  const user = await getCurrentUser();
  const planId = String(formData.get("planId") ?? "");
  const apiSlug = String(formData.get("apiSlug") ?? "");
  const units = Math.max(1, Number(formData.get("units") ?? 1) || 1);

  if (!user) redirect(`/signin?next=${encodeURIComponent(`/marketplace/${apiSlug}`)}`);
  if (!planId) redirect(`/marketplace/${apiSlug}?error=missing-plan`);

  const [plan] = await sql<
    { id: string; api_id: string; name: string; price: string; unit: string | null; quota: number }[]
  >`
    SELECT p.id, p.api_id, p.name, p.price, p.unit, p.quota
    FROM plans p WHERE p.id = ${planId} LIMIT 1
  `;
  if (!plan) redirect(`/marketplace/${apiSlug}?error=unknown-plan`);

  const price = Number(plan.price);
  const billableUnits = plan.unit ? units : 1;

  // --- free plan: activate straight away -----------------------------------
  if (price === 0) {
    await sql`
      INSERT INTO subscriptions (user_id, api_id, plan_id, status, quota, units, current_period_end)
      VALUES (${user.id}, ${plan.api_id}, ${plan.id}, 'active', ${plan.quota},
              ${billableUnits}, ${periodEnd()})
      ON CONFLICT (user_id, api_id) DO UPDATE
        SET plan_id = EXCLUDED.plan_id, status = 'active', quota = EXCLUDED.quota,
            units = EXCLUDED.units, current_period_end = EXCLUDED.current_period_end,
            updated_at = now()
    `;
    revalidatePath("/dashboard");
    redirect("/dashboard?subscribed=1");
  }

  // --- paid plan: needs Paystack -------------------------------------------
  if (!isConfigured()) {
    redirect(`/marketplace/${apiSlug}?error=payments-unconfigured`);
  }

  const [subscription] = await sql<{ id: string }[]>`
    INSERT INTO subscriptions (user_id, api_id, plan_id, status, quota, units, current_period_end)
    VALUES (${user.id}, ${plan.api_id}, ${plan.id}, 'pending', ${plan.quota}, ${billableUnits}, NULL)
    ON CONFLICT (user_id, api_id) DO UPDATE
      SET plan_id = EXCLUDED.plan_id, status = 'pending', quota = EXCLUDED.quota,
          units = EXCLUDED.units, updated_at = now()
    RETURNING id
  `;

  const reference = `zph_${randomBytes(12).toString("hex")}`;
  const amount = toSubunits(price * billableUnits);

  await sql`
    INSERT INTO payments (user_id, subscription_id, reference, amount, currency, status)
    VALUES (${user.id}, ${subscription.id}, ${reference}, ${amount / 100}, ${PAYSTACK_CURRENCY}, 'pending')
  `;

  let authorizationUrl: string;
  try {
    const init = await initializeTransaction({
      email: user.email,
      amountSubunits: amount,
      reference,
      callbackUrl: `${appUrl()}/billing/callback`,
      metadata: { userId: user.id, subscriptionId: subscription.id, planId: plan.id, apiSlug },
    });
    authorizationUrl = init.authorizationUrl;
  } catch (err) {
    await sql`UPDATE payments SET status = 'failed' WHERE reference = ${reference}`;
    console.error("Paystack initialize failed:", err);
    redirect(`/marketplace/${apiSlug}?error=payment-init-failed`);
  }

  redirect(authorizationUrl);
}

export async function cancelSubscription(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await sql`
    UPDATE subscriptions SET status = 'cancelled', updated_at = now()
    WHERE id = ${id} AND user_id = ${user.id}
  `;
  revalidatePath("/dashboard");
}
