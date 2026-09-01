"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, hashPassword, verifyPassword, createSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { clearSetting, setSetting } from "@/lib/settings";
import { getPaystackConfig, testSecretKey } from "@/lib/paystack";
import { getEmailConfig, sendEmail, emailShell } from "@/lib/email";
import { sampleInvoiceDocument } from "@/server/invoices";
import { renderInvoiceHtml, renderInvoiceText } from "@/lib/invoice";
import { sweepRenewalReminders } from "@/server/notifications";
import { applySchema, getSchemaStatus } from "@/server/schema-status";
import { seedCatalogue } from "@/server/catalog-seed";
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

const emailSchema = z.object({
  from: z
    .string()
    .trim()
    .max(120)
    .refine(
      (v) => v === "" || /^[^<>@]*<[^@\s]+@[^@\s]+\.[a-z]{2,}>$|^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v),
      'Use an address, optionally with a name: Zephiel API <info@zephiel.com>'
    ),
});

/** Save the email provider key and sender address. */
export async function saveEmailSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();

  const parsed = emailSchema.safeParse({ from: String(formData.get("from") ?? "") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const key = String(formData.get("apiKey") ?? "").trim();

  // Blank means "keep the stored key", so saving a sender never wipes it.
  if (key) {
    if (!key.startsWith("re_")) return { error: "A Resend API key starts with re_." };
    await setSetting("resend_api_key", key, admin.id);
  }

  if (parsed.data.from) await setSetting("email_from", parsed.data.from, admin.id);

  revalidatePath("/admin/settings");
  return { ok: key ? "Email key saved." : "Sender address saved." };
}

export async function removeEmailKey() {
  await requireAdmin();
  await clearSetting("resend_api_key");
  revalidatePath("/admin/settings");
}

/** Send a specimen reminder to the signed-in administrator. */
const sampleSchema = z.object({
  to: z.string().trim().toLowerCase().email("Enter the address to send the sample to."),
  kind: z.enum(["receipt", "invoice", "reminder"]),
});

/**
 * Send a sample of a real template to any address.
 *
 * Rendered with the same functions that produce the live documents, so what
 * arrives is what a customer receives — not a separate preview that can drift
 * from the thing it is previewing.
 */
export async function sendSampleEmail(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const config = await getEmailConfig();
  if (!config.apiKey) return { error: "No email provider configured yet." };

  const parsed = sampleSchema.safeParse({
    to: String(formData.get("to") ?? ""),
    kind: String(formData.get("kind") ?? "receipt"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  const { to, kind } = parsed.data;

  if (kind === "reminder") {
    const sent = await sendEmail({
      to,
      subject: "[Sample] Your Zephiel subscription renews in 7 days",
      html: emailShell({
        heading: "Your subscription renews in 7 days",
        intro: "This is a sample renewal reminder sent from the admin console. No action is needed.",
        rows: [
          { label: "API", value: "Multistore" },
          { label: "Plan", value: "Standard (3 stores)" },
          { label: "Renews", value: new Date(Date.now() + 6048e5).toDateString() },
        ],
        footer: "Sample message — this does not relate to a real subscription.",
      }),
      text: "Sample renewal reminder from the Zephiel admin console.",
    });
    return sent.ok ? { ok: `Sample reminder sent to ${to}.` } : { error: `Could not send: ${sent.error}` };
  }

  const doc = await sampleInvoiceDocument(kind);
  const sent = await sendEmail({
    to,
    subject: `[Sample] ${doc.company.name} ${kind} ${doc.invoiceNumber}`,
    html: renderInvoiceHtml(doc),
    text: renderInvoiceText(doc),
  });

  return sent.ok
    ? { ok: `Sample ${kind} sent to ${to}.` }
    : { error: `Could not send: ${sent.error}` };
}

export async function sendTestEmail(_prev: FormState): Promise<FormState> {
  const admin = await requireAdmin();

  const config = await getEmailConfig();
  if (!config.apiKey) return { error: "No email provider configured yet." };

  const sent = await sendEmail({
    to: admin.email,
    subject: "Zephiel API — test email",
    html: emailShell({
      heading: "Your email settings work",
      intro:
        "This is a test message from the Zephiel admin console. Renewal reminders will look like this.",
      rows: [
        { label: "Sender", value: config.from },
        { label: "Provider", value: "Resend" },
        { label: "Key source", value: config.source === "settings" ? "Admin console" : "Environment" },
      ],
      footer: "Sent manually from the admin console.",
    }),
    text: "Your Zephiel email settings work. Renewal reminders will be delivered this way.",
  });

  return sent.ok
    ? { ok: `Test email sent to ${admin.email}.` }
    : { error: `Could not send: ${sent.error}` };
}

/** Run the renewal sweep immediately, rather than waiting for the daily cron. */
export async function runRenewalSweep(_prev: FormState): Promise<FormState> {
  await requireAdmin();

  const config = await getEmailConfig();
  if (!config.apiKey) return { error: "Configure an email provider first." };

  const result = await sweepRenewalSweepSafe();
  revalidatePath("/admin/notifications");

  return {
    ok: `Checked ${result.considered} subscription${result.considered === 1 ? "" : "s"} — ${result.sent} sent, ${result.skipped} already notified, ${result.failed} failed.`,
  };
}

async function sweepRenewalSweepSafe() {
  try {
    return await sweepRenewalReminders();
  } catch (err) {
    console.error("Renewal sweep failed:", err);
    return { considered: 0, sent: 0, skipped: 0, failed: 0, details: [] };
  }
}

/**
 * Apply the schema from the admin console.
 *
 * The file only contains IF NOT EXISTS statements, so this creates what is
 * missing and leaves everything else — including all data — untouched.
 */
export async function runMigrations(_prev: FormState): Promise<FormState> {
  await requireAdmin();

  const before = await getSchemaStatus();

  try {
    await applySchema();
  } catch (err) {
    console.error("Migration failed:", err);
    return {
      error: `Migration failed: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  }

  const after = await getSchemaStatus();
  revalidatePath("/admin/settings");

  const createdTables = before.missingTables.filter((t) => !after.missingTables.includes(t));
  const createdColumns = before.missingColumns.filter((c) => !after.missingColumns.includes(c));
  const changes = [...createdTables, ...createdColumns];

  if (!after.upToDate) {
    return {
      error: `Applied, but still missing: ${[...after.missingTables, ...after.missingColumns].join(", ")}`,
    };
  }

  return {
    ok: changes.length
      ? `Schema up to date. Added ${changes.join(", ")}.`
      : "Schema was already up to date — nothing changed.",
  };
}

/**
 * Load the catalogue from the data files shipped with this build.
 *
 * Content is upserted by slug. Plans, endpoints, and the seeded reviews are
 * owned by those files and replaced; accounts, subscriptions, payments, keys,
 * usage, and customer-written reviews are never touched.
 */
export async function reseedCatalogue(_prev: FormState): Promise<FormState> {
  await requireAdmin();

  try {
    const r = await seedCatalogue();
    revalidatePath("/");
    revalidatePath("/marketplace");
    revalidatePath("/blog");
    revalidatePath("/admin/apis");

    return {
      ok:
        `Loaded ${r.apis} APIs, ${r.categories} categories, ${r.plans} plans, ` +
        `${r.endpoints} endpoints, ${r.reviews} reviews, and ${r.posts} posts.`,
    };
  } catch (err) {
    console.error("Reseed failed:", err);
    return { error: `Could not load the catalogue: ${err instanceof Error ? err.message : "unknown error"}` };
  }
}

const companySchema = z.object({
  companyName: z.string().trim().max(120),
  companyAddress: z.string().trim().max(400),
  companyTaxId: z.string().trim().max(60),
});

/**
 * Business identity printed on invoices and receipts.
 *
 * Kept as settings rather than constants: these are the operator's own
 * registered details, and inventing a plausible-looking address for a document
 * that customers keep for their accounts would be worse than leaving it blank.
 */
export async function saveCompanyDetails(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();

  const parsed = companySchema.safeParse({
    companyName: String(formData.get("companyName") ?? ""),
    companyAddress: String(formData.get("companyAddress") ?? ""),
    companyTaxId: String(formData.get("companyTaxId") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  await setSetting("company_name", parsed.data.companyName, admin.id);
  await setSetting("company_address", parsed.data.companyAddress, admin.id);
  await setSetting("company_tax_id", parsed.data.companyTaxId, admin.id);

  revalidatePath("/admin/settings");
  return { ok: "Invoice details saved." };
}

const adminEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  current: z.string().min(1, "Enter your current password to confirm."),
});

/**
 * Change the signed-in administrator's own sign-in address.
 *
 * The email is the login identifier, so moving it is a credential change: it
 * takes the current password for the same reason the password form does, and
 * drops other sessions afterwards.
 */
export async function changeEmail(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();

  const parsed = adminEmailSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    current: String(formData.get("current") ?? ""),
  });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  const next = parsed.data.email;
  if (next === admin.email.toLowerCase()) {
    return { error: "That is already your sign-in address." };
  }

  const [row] = await sql<{ password_hash: string }[]>`
    SELECT password_hash FROM users WHERE id = ${admin.id} LIMIT 1
  `;
  if (!row || !(await verifyPassword(parsed.data.current, row.password_hash))) {
    return { error: "Your current password is incorrect." };
  }

  // users.email is unique; check first so this reports a readable message
  // rather than surfacing a constraint violation.
  const [taken] = await sql<{ id: string }[]>`
    SELECT id FROM users WHERE lower(email) = ${next} AND id <> ${admin.id} LIMIT 1
  `;
  if (taken) return { error: "Another account already uses that address." };

  await sql`UPDATE users SET email = ${next} WHERE id = ${admin.id}`;

  await sql`DELETE FROM sessions WHERE user_id = ${admin.id}`;
  await createSession(admin.id);

  revalidatePath("/admin/settings");
  return { ok: `Sign-in address changed to ${next}. Use it next time you sign in.` };
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
