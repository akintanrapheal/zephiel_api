import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { hashApiKey, generateApiKey } from "@/lib/auth";
import { storeLimitFor } from "@/lib/plans";

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
  if (name.length > 80) return fail(400, "name_too_long", "Store names are limited to 80 characters.");
  const domain = (payload.domain ?? "").trim();
  if (domain.length > 255) return fail(400, "domain_too_long", "Domains are limited to 255 characters.");

  // The active Multistore API subscription this account holds.
  const [sub] = await sql<{ id: string; price: number; plan_name: string }[]>`
    SELECT s.id, p.price::float8 AS price, p.name AS plan_name
    FROM subscriptions s
    JOIN apis a ON a.id = s.api_id
    JOIN plans p ON p.id = s.plan_id
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
    // The plan's store allowance applies here exactly as it does in the
    // dashboard. Without this an account could provision past its limit by
    // calling the API instead of using the UI.
    const limit = storeLimitFor(sub.price);
    const [{ count }] = await sql<{ count: string }[]>`
      SELECT COUNT(*)::text AS count FROM stores WHERE subscription_id = ${sub.id}
    `;
    if (Number(count) >= limit) {
      return fail(
        403,
        "store_limit_reached",
        `The ${sub.plan_name} plan connects up to ${limit} stores. Upgrade to add more.`
      );
    }

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

  // Issue a fresh per-store key. Only the digest is stored; the plaintext is
  // returned once so the caller can save it and present it on future gateway
  // calls.
  //
  // Re-provisioning revokes whatever this store had. Previously each call
  // stacked another live key on the same store with nothing retiring the old
  // ones, so a retrying client left a trail of valid credentials behind it.
  const apiKey = generateApiKey(true);
  await sql.begin(async (tx) => {
    await tx`
      UPDATE api_keys SET revoked_at = now()
      WHERE store_id = ${store.id} AND revoked_at IS NULL
    `;
    await tx`
      INSERT INTO api_keys (user_id, store_id, label, scope, key_prefix, key_hash)
      VALUES (${key.user_id}, ${store.id}, ${`${name} (store)`}, 'Multistore API', ${apiKey.prefix}, ${apiKey.hash})
    `;
  });

  return NextResponse.json({ ok: true, storeId: store.id, apiKey: apiKey.plaintext });
}

function fail(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}
