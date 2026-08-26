"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sql } from "@/lib/db";
import { generateApiKey, requireUser } from "@/lib/auth";

export type KeyState = { error?: string; created?: string } | null;

export async function createKey(_prev: KeyState, formData: FormData): Promise<KeyState> {
  const user = await requireUser();

  const label = z
    .string()
    .trim()
    .min(1)
    .max(60)
    .safeParse(formData.get("label") ?? "");

  if (!label.success) return { error: "Give the key a short label." };

  const [{ count }] = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count FROM api_keys
    WHERE user_id = ${user.id} AND revoked_at IS NULL
  `;
  if (Number(count) >= 20) return { error: "Key limit reached. Revoke an unused key first." };

  const key = generateApiKey();
  await sql`
    INSERT INTO api_keys (user_id, label, scope, key_prefix, key_hash)
    VALUES (${user.id}, ${label.data}, 'All APIs', ${key.prefix}, ${key.hash})
  `;

  revalidatePath("/dashboard");
  // Returned once — only the hash is stored, so it can never be shown again.
  return { created: key.plaintext };
}

export async function revokeKey(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await sql`
    UPDATE api_keys SET revoked_at = now()
    WHERE id = ${id} AND user_id = ${user.id} AND revoked_at IS NULL
  `;
  revalidatePath("/dashboard");
}
