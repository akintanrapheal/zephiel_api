"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sql } from "@/lib/db";
import { generateApiKey, requireUser } from "@/lib/auth";

export type KeyState = { error?: string; created?: string; label?: string } | null;

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

/**
 * Replace a key with a new one under the same label.
 *
 * The plaintext of the old key cannot be recovered — only its digest is
 * stored — so rotation is the only way to get a usable value back if the
 * original was lost.
 */
export async function rotateKey(_prev: KeyState, formData: FormData): Promise<KeyState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing key." };

  const [existing] = await sql<{ id: string; label: string; scope: string; store_id: string | null }[]>`
    SELECT id, label, scope, store_id FROM api_keys
    WHERE id = ${id} AND user_id = ${user.id} AND revoked_at IS NULL
    LIMIT 1
  `;
  if (!existing) return { error: "Key not found." };

  const key = generateApiKey();

  await sql.begin(async (tx) => {
    await tx`DELETE FROM api_keys WHERE id = ${existing.id}`;
    await tx`
      INSERT INTO api_keys (user_id, store_id, label, scope, key_prefix, key_hash)
      VALUES (${user.id}, ${existing.store_id}, ${existing.label}, ${existing.scope},
              ${key.prefix}, ${key.hash})
    `;
  });

  revalidatePath("/dashboard/keys");
  revalidatePath("/dashboard/stores");
  return { created: key.plaintext, label: existing.label };
}
