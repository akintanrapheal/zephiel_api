"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, hashPassword, verifyPassword, createSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { clearSetting, setSetting } from "@/lib/settings";
import { getPaystackConfig, testSecretKey } from "@/lib/paystack";
import type { FormState } from "./admin";

const paystackSchema = z.object({
  currency: z.enum(["NGN", "GHS", "ZAR", "KES", "USD"]),
  usdToNgn: z.coerce.number().positive().max(100_000),
});

export async function savePaystackSettings(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const admin = await requireAdmin();

  const parsed = paystackSchema.safeParse({
    currency: String(formData.get("currency") ?? "NGN"),
    usdToNgn: formData.get("usdToNgn") || 1550,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the values and try again." };
  }

  const secret = String(formData.get("secretKey") ?? "").trim();

  // An empty field means "leave the stored key alone", so a save that only
  // changes the currency never wipes the key.
  if (secret) {
    if (!/^sk_(test|live)_[A-Za-z0-9]{10,}$/.test(secret)) {
      return { error: "That does not look like a Paystack secret key (sk_test_… or sk_live_…)." };
    }

    const probe = await testSecretKey(secret);
    if (!probe.ok) return { error: `Key rejected: ${probe.message}` };

    await setSetting("paystack_secret_key", secret, admin.id);
  }

  await setSetting("paystack_currency", parsed.data.currency, admin.id);
  await setSetting("usd_to_ngn", String(parsed.data.usdToNgn), admin.id);

  revalidatePath("/admin/settings");
  revalidatePath("/admin");
  return { ok: secret ? "Key verified with Paystack and saved." : "Settings saved." };
}

export async function removePaystackKey() {
  await requireAdmin();
  await clearSetting("paystack_secret_key");
  revalidatePath("/admin/settings");
  revalidatePath("/admin");
}

export async function testPaystackConnection(_prev: FormState): Promise<FormState> {
  await requireAdmin();

  const { secretKey, source } = await getPaystackConfig();
  if (!secretKey) return { error: "No key configured yet." };

  const probe = await testSecretKey(secretKey);
  return probe.ok
    ? { ok: `${probe.message} (using the key from ${source === "settings" ? "this console" : "the environment"}.)` }
    : { error: probe.message };
}

const platformSchema = z.object({
  platformName: z.string().trim().min(1).max(60),
  supportEmail: z.string().trim().email().or(z.literal("")),
});

export async function savePlatformSettings(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const admin = await requireAdmin();

  const parsed = platformSchema.safeParse({
    platformName: String(formData.get("platformName") ?? ""),
    supportEmail: String(formData.get("supportEmail") ?? ""),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the values and try again." };
  }

  await setSetting("platform_name", parsed.data.platformName, admin.id);
  await setSetting("support_email", parsed.data.supportEmail, admin.id);

  revalidatePath("/admin/settings");
  return { ok: "Platform settings saved." };
}

const passwordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password."),
    next: z.string().min(12, "Use at least 12 characters."),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { message: "The new passwords do not match." });

/**
 * Change the signed-in administrator's own password.
 *
 * Requires the current password so a borrowed session cannot lock the real
 * owner out, and drops every other session for the account afterwards.
 */
export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();

  const parsed = passwordSchema.safeParse({
    current: String(formData.get("current") ?? ""),
    next: String(formData.get("next") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  const [row] = await sql<{ password_hash: string }[]>`
    SELECT password_hash FROM users WHERE id = ${admin.id} LIMIT 1
  `;
  if (!row || !(await verifyPassword(parsed.data.current, row.password_hash))) {
    return { error: "Your current password is incorrect." };
  }

  if (parsed.data.next === parsed.data.current) {
    return { error: "The new password must be different." };
  }

  await sql`
    UPDATE users SET password_hash = ${await hashPassword(parsed.data.next)}
    WHERE id = ${admin.id}
  `;
  // Invalidate every existing session (anyone signed in with the old password
  // is now out), then issue a fresh one so this browser stays signed in.
  await sql`DELETE FROM sessions WHERE user_id = ${admin.id}`;
  await createSession(admin.id);

  return { ok: "Password changed. Other sessions have been signed out — sign in again there." };
}
