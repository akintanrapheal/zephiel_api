"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
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
      current_period_end = ${ends ? `${ends}T23:59:59Z` : null},
      updated_at = now()
    WHERE id = ${id}
  `;

  const [row] = await sql<{ user_id: string }[]>`
    SELECT user_id FROM subscriptions WHERE id = ${id} LIMIT 1
  `;

  revalidatePath(`/admin/users/${row?.user_id ?? ""}`);
  revalidatePath("/admin/subscriptions");
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
