import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { hashApiKey } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Read-only usage summary for a Multistore API account, authenticated by that account's account-wide
 * key. Powers the live usage chart on the customer's own admin (Sterlin Glams' Subscribe page):
 *   - series:   last 30 days, one zero-filled point per day (total calls across all the account's stores)
 *   - perStore: total calls per connected store over the same window
 *   - quota:    { used, limit } for the current billing period
 * This does NOT consume gateway quota — it only reads the ledger.
 */
export async function GET(request: Request) {
  const accountKey =
    request.headers.get("x-account-key") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!accountKey) return fail(401, "missing_key", "Send your account key in the x-account-key header.");

  const [key] = await sql<{ user_id: string; revoked_at: Date | null; store_id: string | null }[]>`
    SELECT user_id, revoked_at, store_id FROM api_keys WHERE key_hash = ${hashApiKey(accountKey)} LIMIT 1
  `;
  if (!key || key.revoked_at) return fail(401, "invalid_key", "That account key is not valid or has been revoked.");
  if (key.store_id) return fail(403, "not_account_key", "Use an account-wide key here, not a per-store key.");

  const [sub] = await sql<{ id: string; quota: number; used: number }[]>`
    SELECT s.id, s.quota, s.used FROM subscriptions s
    JOIN apis a ON a.id = s.api_id
    WHERE s.user_id = ${key.user_id} AND a.slug = 'multistore' AND s.status = 'active'
    LIMIT 1
  `;
  if (!sub) return fail(403, "no_subscription", "No active Multistore API subscription on this account.");

  // Last 30 days, zero-filled so the chart line is continuous even on quiet days.
  const series = await sql<{ day: string; count: number }[]>`
    SELECT to_char(d::date, 'YYYY-MM-DD') AS day, COALESCE(u.c, 0)::int AS count
    FROM generate_series((now() - interval '29 days')::date, now()::date, interval '1 day') d
    LEFT JOIN (
      SELECT ue.created_at::date AS day, COUNT(*) AS c
      FROM usage_events ue
      JOIN stores st ON st.id = ue.store_id AND st.subscription_id = ${sub.id}
      WHERE ue.created_at >= (now() - interval '29 days')::date
      GROUP BY 1
    ) u ON u.day = d::date
    ORDER BY d
  `;

  // Per-store totals over the same window (LEFT JOIN so a store with no calls still shows as 0).
  const perStore = await sql<{ store: string; count: number }[]>`
    SELECT st.name AS store, COUNT(ue.id)::int AS count
    FROM stores st
    LEFT JOIN usage_events ue
      ON ue.store_id = st.id AND ue.created_at >= (now() - interval '29 days')
    WHERE st.subscription_id = ${sub.id}
    GROUP BY st.name
    ORDER BY count DESC, st.name
  `;

  return NextResponse.json({
    ok: true,
    quota: { used: sub.used, limit: sub.quota },
    series,
    perStore,
  });
}

function fail(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}
