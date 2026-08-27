"use server";

import { createHash, randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { sql } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { sendEmail, emailShell, isEmailConfigured } from "@/lib/email";
import { appUrl } from "@/lib/app-url";
import type { FormState } from "./admin";

const TOKEN_TTL_MINUTES = 45;

const digest = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * Begin a password reset.
 *
 * Always reports success, whether or not the address exists — otherwise the
 * form becomes a way to discover which emails have accounts. Only the token's
 * digest is stored, so the table itself cannot be used to reset anyone.
 */
export async function requestReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .safeParse(formData.get("email"));

  const generic = {
    ok: "If that address has an account, a reset link is on its way. It expires in 45 minutes.",
  };

  if (!parsed.success) return generic;

  const [user] = await sql<{ id: string; name: string }[]>`
    SELECT id, name FROM users WHERE email = ${parsed.data} LIMIT 1
  `;
  if (!user) return generic;

  if (!(await isEmailConfigured())) {
    return { error: "Password reset is unavailable — this deployment has no email provider set up." };
  }

  // Supersede any outstanding link for this account.
  await sql`DELETE FROM password_resets WHERE user_id = ${user.id} AND used_at IS NULL`;

  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000);

  await sql`
    INSERT INTO password_resets (token_hash, user_id, expires_at)
    VALUES (${digest(token)}, ${user.id}, ${expires})
  `;

  const link = `${appUrl()}/reset?token=${token}`;

  const sent = await sendEmail({
    to: parsed.data,
    subject: "Reset your Zephiel password",
    html: emailShell({
      heading: "Reset your password",
      intro: `Hello${user.name ? ` ${user.name.split(" ")[0]}` : ""}, use the button below to choose a new password. The link expires in ${TOKEN_TTL_MINUTES} minutes and can be used once.`,
      bodyNote: "If you did not ask for this, nothing has changed and you can ignore this message.",
      ctaLabel: "Choose a new password",
      ctaHref: link,
      footer: "Sent because a password reset was requested for this address.",
    }),
    text: `Reset your Zephiel password:\n\n${link}\n\nExpires in ${TOKEN_TTL_MINUTES} minutes. If you did not ask for this, ignore this message.`,
  });

  if (!sent.ok) console.error("Reset email failed:", sent.error);

  return generic;
}

const completeSchema = z
  .object({
    token: z.string().min(10),
    password: z.string().min(12, "Use at least 12 characters."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Those passwords do not match." });

/** Complete a reset: consume the token, set the password, drop every session. */
export async function completeReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = completeSchema.safeParse({
    token: String(formData.get("token") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const [row] = await sql<{ user_id: string }[]>`
    SELECT user_id FROM password_resets
    WHERE token_hash = ${digest(parsed.data.token)}
      AND used_at IS NULL
      AND expires_at > now()
    LIMIT 1
  `;

  if (!row) return { error: "That link has expired or has already been used. Request a new one." };

  await sql.begin(async (tx) => {
    await tx`
      UPDATE users SET password_hash = ${await hashPassword(parsed.data.password)}
      WHERE id = ${row.user_id}
    `;
    await tx`
      UPDATE password_resets SET used_at = now() WHERE token_hash = ${digest(parsed.data.token)}
    `;
    // Anyone signed in with the old password is signed out.
    await tx`DELETE FROM sessions WHERE user_id = ${row.user_id}`;
  });

  redirect("/signin?reset=1");
}
