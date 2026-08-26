import "server-only";
import { sql } from "@/lib/db";
import type { ApiKey, Subscription } from "@/lib/types";

export async function getSubscriptions(userId: string): Promise<Subscription[]> {
  return sql<Subscription[]>`
    SELECT
      s.id, s.user_id AS "userId", s.api_id AS "apiId",
      a.name AS "apiName", a.slug AS "apiSlug", a.logo AS "apiLogo", a.color AS "apiColor",
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

/** Daily call counts for the last `days` days, zero-filled for gaps. */
export async function getUsageSeries(userId: string, days = 30) {
  const rows = await sql<{ day: Date; calls: string }[]>`
    SELECT date_trunc('day', created_at) AS day, COUNT(*)::text AS calls
    FROM usage_events
    WHERE user_id = ${userId}
      AND created_at >= now() - (${days}::text || ' days')::interval
    GROUP BY 1
    ORDER BY 1
  `;

  const byDay = new Map(rows.map((r) => [new Date(r.day).toDateString(), Number(r.calls)]));
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
      (SELECT COUNT(*) FROM usage_events
        WHERE user_id = ${userId}
          AND created_at >= date_trunc('month', now()))::text AS calls,
      (SELECT COALESCE(SUM(p.price * s.units), 0) FROM subscriptions s
        JOIN plans p ON p.id = s.plan_id
        WHERE s.user_id = ${userId} AND s.status = 'active')::text AS spend,
      (SELECT COUNT(*) FROM usage_events
        WHERE user_id = ${userId} AND status >= 400
          AND created_at >= date_trunc('month', now()))::text AS errors
  `;

  const calls = Number(row?.calls ?? 0);
  const errors = Number(row?.errors ?? 0);
  return {
    calls,
    spend: Number(row?.spend ?? 0),
    errorRate: calls === 0 ? 0 : (errors / calls) * 100,
  };
}
