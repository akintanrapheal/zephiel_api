"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sql } from "@/lib/db";
import { storeLimitFor } from "@/lib/plans";
import { generateApiKey, requireUser } from "@/lib/auth";
import { PLATFORMS } from "@/lib/platforms";

export type StoreState = { error?: string; ok?: string; createdKey?: string; storeName?: string } | null;

const storeSchema = z.object({
  name: z.string().trim().min(1, "Give the store a name.").max(60),
  platform: z.enum(PLATFORMS),
  domain: z
    .string()
    .trim()
    .max(120)
    .transform((v) => v.replace(/^https?:\/\//i, "").replace(/\/$/, ""))
    .refine((v) => v === "" || /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(v), "Enter a domain like shop.example.com.")
    .optional(),
});

/**
 * Connect a storefront.
 *
 * Each store gets its own key so calls can be attributed per store and one
 * can be revoked in isolation. The subscription's billable unit count is kept
 * equal to the number of stores, which is what the $50/store plan charges on.
 */
export async function addStore(_prev: StoreState, formData: FormData): Promise<StoreState> {
  const user = await requireUser();

  const parsed = storeSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    platform: String(formData.get("platform") ?? "shopify"),
    domain: String(formData.get("domain") ?? ""),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const [sub] = await sql<{ id: string; price: number; plan_name: string }[]>`
    SELECT s.id, p.price::float8 AS price, p.name AS plan_name
    FROM subscriptions s
    JOIN apis a ON a.id = s.api_id
    JOIN plans p ON p.id = s.plan_id
    WHERE s.user_id = ${user.id} AND a.slug = 'multistore' AND s.status = 'active'
    LIMIT 1
  `;

  if (!sub) {
    return { error: "You need an active Multistore subscription before connecting a store." };
  }

  // The ceiling follows the plan. It used to be a flat 100 regardless, so the
  // Sandbox tier's advertised store allowance was never actually enforced.
  const limit = storeLimitFor(sub.price);
  const [{ count }] = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count FROM stores WHERE subscription_id = ${sub.id}
  `;
  if (Number(count) >= limit) {
    return {
      error:
        sub.price === 0
          ? `The ${sub.plan_name} plan connects up to ${limit} stores. Upgrade to add more.`
          : `Store limit of ${limit} reached. Contact sales for a larger plan.`,
    };
  }

  const key = generateApiKey();

  const store = await sql.begin(async (tx) => {
    const [created] = await tx<{ id: string; name: string }[]>`
      INSERT INTO stores (user_id, subscription_id, name, platform, domain)
      VALUES (${user.id}, ${sub.id}, ${parsed.data.name}, ${parsed.data.platform},
              ${parsed.data.domain ?? ""})
      RETURNING id, name
    `;

    await tx`
      INSERT INTO api_keys (user_id, store_id, label, scope, key_prefix, key_hash)
      VALUES (${user.id}, ${created.id}, ${parsed.data.name}, 'Multistore', ${key.prefix}, ${key.hash})
    `;

    // Keep billable units in step with the number of connected stores.
    await tx`
      UPDATE subscriptions
      SET units = (SELECT COUNT(*) FROM stores WHERE subscription_id = ${sub.id}),
          updated_at = now()
      WHERE id = ${sub.id}
    `;

    return created;
  });

  revalidatePath("/dashboard/stores");
  revalidatePath("/dashboard");

  // Returned once — only the digest is stored.
  return { createdKey: key.plaintext, storeName: store.name, ok: `${store.name} connected.` };
}

export async function removeStore(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const [store] = await sql<{ subscription_id: string }[]>`
    SELECT subscription_id FROM stores WHERE id = ${id} AND user_id = ${user.id} LIMIT 1
  `;
  if (!store) return;

  // The store's key cascades away with it.
  await sql`DELETE FROM stores WHERE id = ${id} AND user_id = ${user.id}`;
  await sql`
    UPDATE subscriptions
    SET units = GREATEST(1, (SELECT COUNT(*) FROM stores WHERE subscription_id = ${store.subscription_id})),
        updated_at = now()
    WHERE id = ${store.subscription_id}
  `;

  revalidatePath("/dashboard/stores");
  revalidatePath("/dashboard");
}

export async function rotateStoreKey(_prev: StoreState, formData: FormData): Promise<StoreState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing store." };

  const [store] = await sql<{ id: string; name: string }[]>`
    SELECT id, name FROM stores WHERE id = ${id} AND user_id = ${user.id} LIMIT 1
  `;
  if (!store) return { error: "Store not found." };

  const key = generateApiKey();

  await sql.begin(async (tx) => {
    await tx`DELETE FROM api_keys WHERE store_id = ${store.id} AND user_id = ${user.id}`;
    await tx`
      INSERT INTO api_keys (user_id, store_id, label, scope, key_prefix, key_hash)
      VALUES (${user.id}, ${store.id}, ${store.name}, 'Multistore', ${key.prefix}, ${key.hash})
    `;
  });

  revalidatePath("/dashboard/stores");
  return { createdKey: key.plaintext, storeName: store.name, ok: "Key rotated — the previous one no longer works." };
}

export async function setStoreStatus(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!id || !["synced", "syncing", "sandbox", "error"].includes(status)) return;

  await sql`UPDATE stores SET status = ${status} WHERE id = ${id} AND user_id = ${user.id}`;
  revalidatePath("/dashboard/stores");
}
