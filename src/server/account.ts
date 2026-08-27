import "server-only";
import { sql } from "@/lib/db";
import type { ApiKey, Subscription } from "@/lib/types";

export async function getSubscriptions(userId: string): Promise<Subscription[]> {
  return sql<Subscription[]>`
    SELECT
      s.id, s.user_id AS "userId", s.api_id AS "apiId",
      a.name AS "apiName", a.slug AS "apiSlug", a.logo AS "apiLogo", a.color AS "apiColor", a.icon AS "apiIcon",
      p.name AS "planName", p.price::float8 AS "planPrice", p.unit AS "planUnit",
      s.status, s.quota, s.used, s.units,
      s.current_period_end AS "currentPeriodEnd", s.created_at AS "createdAt"
    FROM subscriptions s
    JOIN apis a  ON a.id = s.api_id
    JOIN plans p ON p.id = s.plan_id
    WHERE s.user_id = ${userId}
    ORDER BY s.created_at DESC
  `;
}

export async function getApiKeys(userId: string): Promise<ApiKey[]> {
  return sql<ApiKey[]>`
    SELECT
      id, label, scope,
      key_prefix   AS "keyPrefix",
      last_used_at AS "lastUsedAt",
      revoked_at   AS "revokedAt",
      created_at   AS "createdAt"
    FROM api_keys
    WHERE user_id = ${userId}
    ORDER BY created_at
  `;
}

/**
 * Daily call counts for the last `days` days, zero-filled for gaps.
 *
 * Reads the rollup table for history and usage_events for the current day, so
 * a long series costs one small scan rather than aggregating millions of rows.
 */
export async function getUsageSeries(userId: string, days = 30) {
  const rows = await sql<{ day: Date; calls: string }[]>`
    SELECT d.day, SUM(d.calls)::text AS calls
    FROM usage_daily d
    WHERE d.user_id = ${userId}
      AND d.day >= (CURRENT_DATE - ${days}::int)
      AND d.day < CURRENT_DATE
    GROUP BY d.day

    UNION ALL

    SELECT CURRENT_DATE AS day, COUNT(*)::text AS calls
    FROM usage_events e
    WHERE e.user_id = ${userId} AND e.created_at >= CURRENT_DATE

    ORDER BY day
  `;

  const byDay = new Map<string, number>();
  for (const r of rows) {
    const key = new Date(r.day).toDateString();
    byDay.set(key, (byDay.get(key) ?? 0) + Number(r.calls));
  }

  const out: { date: string; calls: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    out.push({
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      calls: byDay.get(d.toDateString()) ?? 0,
    });
  }
  return out;
}

export async function getRecentRequests(userId: string, limit = 8) {
  return sql<
    { method: string; endpoint: string; status: number; latency_ms: number; created_at: Date }[]
  >`
    SELECT method, endpoint, status, latency_ms, created_at
    FROM usage_events
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
}

export async function getAccountSummary(userId: string) {
  const [row] = await sql<{ calls: string; spend: string; errors: string }[]>`
    SELECT
      (
        COALESCE((SELECT SUM(calls) FROM usage_daily
          WHERE user_id = ${userId} AND day >= date_trunc('month', now())::date AND day < CURRENT_DATE), 0)
        + (SELECT COUNT(*) FROM usage_events
          WHERE user_id = ${userId} AND created_at >= CURRENT_DATE)
      )::text AS calls,
      (SELECT COALESCE(SUM(p.price * s.units), 0) FROM subscriptions s
        JOIN plans p ON p.id = s.plan_id
        WHERE s.user_id = ${userId} AND s.status = 'active')::text AS spend,
      (
        COALESCE((SELECT SUM(errors) FROM usage_daily
          WHERE user_id = ${userId} AND day >= date_trunc('month', now())::date AND day < CURRENT_DATE), 0)
        + (SELECT COUNT(*) FROM usage_events
          WHERE user_id = ${userId} AND status >= 400 AND created_at >= CURRENT_DATE)
      )::text AS errors
  `;

  const calls = Number(row?.calls ?? 0);
  const errors = Number(row?.errors ?? 0);
  return {
    calls,
    spend: Number(row?.spend ?? 0),
    errorRate: calls === 0 ? 0 : (errors / calls) * 100,
  };
}

export async function getUsageByApi(userId: string) {
  const rows = await sql<{ name: string; color: string; calls: string }[]>`
    SELECT a.name, a.color, SUM(t.calls)::text AS calls
    FROM (
      SELECT api_id, calls FROM usage_daily WHERE user_id = ${userId}
      UNION ALL
      SELECT api_id, 1 FROM usage_events WHERE user_id = ${userId} AND created_at >= CURRENT_DATE
    ) t
    JOIN apis a ON a.id = t.api_id
    GROUP BY a.id, a.name, a.color
    ORDER BY SUM(t.calls) DESC
    LIMIT 10
  `;
  return rows.map((r) => ({ name: r.name, color: r.color, calls: Number(r.calls) }));
}

export type Store = {
  id: string;
  name: string;
  platform: string;
  domain: string;
  status: string;
  keyPrefix: string | null;
  calls: number;
  lastCall: Date | null;
  createdAt: Date;
};

export async function getStores(userId: string): Promise<Store[]> {
  return sql<Store[]>`
    SELECT
      st.id, st.name, st.platform, st.domain, st.status, st.created_at AS "createdAt",
      k.key_prefix AS "keyPrefix",
      (
        COALESCE((SELECT SUM(d.calls) FROM usage_daily d WHERE d.store_id = st.id), 0)
        + (SELECT COUNT(*) FROM usage_events e WHERE e.store_id = st.id AND e.created_at >= CURRENT_DATE)
      )::int AS calls,
      (SELECT MAX(e.created_at) FROM usage_events e WHERE e.store_id = st.id) AS "lastCall"
    FROM stores st
    LEFT JOIN api_keys k ON k.store_id = st.id AND k.revoked_at IS NULL
    WHERE st.user_id = ${userId}
    ORDER BY st.created_at
  `;
}

/**
 * Calls per store in five-minute buckets over the last `hours` hours.
 *
 * generate_series produces every bucket so gaps render as zero rather than
 * the line jumping across missing time.
 */
export async function getStoreActivity(userId: string, hours = 6) {
  const rows = await sql<{ bucket: Date; store_id: string; calls: string }[]>`
    SELECT
      b.bucket,
      st.id AS store_id,
      COUNT(e.id)::text AS calls
    FROM generate_series(
      date_trunc('hour', now() - (${hours}::text || ' hours')::interval),
      now(),
      interval '5 minutes'
    ) AS b(bucket)
    CROSS JOIN stores st
    LEFT JOIN usage_events e
      ON e.store_id = st.id
     AND e.created_at >= b.bucket
     AND e.created_at <  b.bucket + interval '5 minutes'
    WHERE st.user_id = ${userId}
    GROUP BY b.bucket, st.id
    ORDER BY b.bucket
  `;

  const buckets: string[] = [];
  const seen = new Set<string>();
  const byStore = new Map<string, number[]>();

  for (const r of rows) {
    const iso = new Date(r.bucket).toISOString();
    if (!seen.has(iso)) {
      seen.add(iso);
      buckets.push(iso);
    }
    if (!byStore.has(r.store_id)) byStore.set(r.store_id, []);
    byStore.get(r.store_id)!.push(Number(r.calls));
  }

  return { buckets, byStore: Object.fromEntries(byStore) };
}
