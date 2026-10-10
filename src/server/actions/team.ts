"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sql } from "@/lib/db";
import { requireAccountOwner, hashPassword } from "@/lib/auth";
import type { FormState } from "./admin";

export type Member = { id: string; email: string; name: string; createdAt: Date };

/** Members belonging to the given account (the owner's user id). */
export async function listMembers(accountId: string): Promise<Member[]> {
  const rows = await sql<{ id: string; email: string; name: string; created_at: Date }[]>`
    SELECT id, email, name, created_at FROM users
    WHERE account_owner_id = ${accountId}
    ORDER BY created_at
  `;
  return rows.map((r) => ({ id: r.id, email: r.email, name: r.name, createdAt: r.created_at }));
}

const addSchema = z.object({
  name: z.string().trim().min(1, "Enter the member's name.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

/**
 * Add a member to the signed-in owner's account. The member is an ordinary user
 * row with account_owner_id set, so they sign in through the normal flow and
 * share the owner's subscriptions, stores, keys, usage, and billing.
 */
export async function addMember(_prev: FormState, formData: FormData): Promise<FormState> {
  const owner = await requireAccountOwner();

  const parsed = addSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  const { name, email, password } = parsed.data;

  const [existing] = await sql<{ id: string }[]>`
    SELECT id FROM users WHERE email = ${email} LIMIT 1
  `;
  if (existing) return { error: "Someone already uses that email address." };

  await sql`
    INSERT INTO users (email, name, password_hash, role, account_owner_id)
    VALUES (${email}, ${name}, ${await hashPassword(password)}, 'customer', ${owner.id})
  `;

  revalidatePath("/dashboard/team");
  return { ok: `${email} can now sign in and use your account.` };
}

/** Remove a member from the owner's account; the account_owner_id match stops
 *  anyone deleting a user that isn't their own member. */
export async function removeMember(formData: FormData): Promise<void> {
  const owner = await requireAccountOwner();
  const memberId = String(formData.get("memberId") ?? "");
  if (!memberId) return;

  await sql`
    DELETE FROM users WHERE id = ${memberId} AND account_owner_id = ${owner.id}
  `;
  revalidatePath("/dashboard/team");
}
