import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { hashApiKey, generateApiKey } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Provisions a per-store API key for a Multistore API customer, authenticated by that account's
 * account-wide key. Lets a connected storefront auto-register each of its stores so their traffic is
 * attributed per store and the key matches on both sides. Re-provisioning an existing store name
 * reuses the store row (no duplicates) but issues a fresh key.
 */
export async function POST(request: Request) {
  const accountKey =
    request.headers.get("x-account-key") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!accountKey) return fail(401, "missing_key", "Send your account key in the x-account-key header.");

  const [key] = await sql<
    { user_id: string; revoked_at: Date | null; store_id: string | null }[]
  >`
    SELECT user_id, revoked_at, store_id FROM api_keys WHERE key_hash = ${hashApiKey(accountKey)} LIMIT 1
  `;
  if (!key || key.revoked_at) return fail(401, "invalid_key", "That account key is not valid or has been revoked.");
  if (key.store_id) return fail(403, "not_account_key", "Use an account-wide key here, not a per-store key.");

  let payload: { name?: string; domain?: string } = {};
  try { payload = (await request.json()) as { name?: string; domain?: string }; } catch { /* empty body */ }
  const name = (payload.name ?? "").trim();
  if (!name) return fail(400, "missing_name", "A store name is required.");
  const domain = (payload.domain ?? "").trim();

  // The active Multistore API subscription this account holds.
  const [sub] = await sql<{ id: string }[]>`
    SELECT s.id FROM subscriptions s
    JOIN apis a ON a.id = s.api_id
    WHERE s.user_id = ${key.user_id} AND a.slug = 'multistore' AND s.status = 'active'
    LIMIT 1
  `;
  if (!sub) return fail(403, "no_subscription", "No active Multistore API subscription on this account.");

  // Reuse the store row by name so repeated calls don't create duplicates.
  let [store] = await sql<{ id: string }[]>`
    SELECT id FROM stores
    WHERE user_id = ${key.user_id} AND subscription_id = ${sub.id} AND name = ${name}
    LIMIT 1
  `;
  if (!store) {
    [store] = await sql<{ id: string }[]>`
      INSERT INTO stores (user_id, subscription_id, name, platform, status, domain)
      VALUES (${key.user_id}, ${sub.id}, ${name}, 'custom', 'synced', ${domain})
      RETURNING id
    `;
    // Keep the per-unit count in step with how many stores are connected.
    await sql`
      UPDATE subscriptions
      SET units = (SELECT COUNT(*) FROM stores WHERE subscription_id = ${sub.id}), updated_at = now()
      WHERE id = ${sub.id}
    `;
  }

  // Issue a fresh per-store key. Only the digest is stored; the plaintext is returned once so the
  // caller (Sterlin Glams) can save it and present it on future gateway calls.
  const apiKey = generateApiKey(true);
  await sql`
    INSERT INTO api_keys (user_id, store_id, label, scope, key_prefix, key_hash)
    VALUES (${key.user_id}, ${store.id}, ${`${name} (store)`}, 'Multistore API', ${apiKey.prefix}, ${apiKey.hash})
  `;

  return NextResponse.json({ ok: true, storeId: store.id, apiKey: apiKey.plaintext });
}

function fail(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}
