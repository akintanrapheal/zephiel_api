import "server-only";
import { sql } from "@/lib/db";

/** How long the hot table keeps individual events before they are summarised. */
const HOT_WINDOW_DAYS = 2;

/** The intraday chart's resolution. */
const BUCKET_MINUTES = 5;

/**
 * Summarise finished days out of usage_events into usage_daily, then drop the
 * events that were folded in.
 *
 * This is ordinary production housekeeping, not demonstration-only: the daily
 * chart reads rollups, so without it real traffic would never appear in the
 * long series and the hot table would grow without bound.
 */
export async function rollupFinishedDays() {
  const inserted = await sql<{ day: Date; calls: string }[]>`
    INSERT INTO usage_daily (user_id, api_id, store_id, day, calls, errors, avg_latency)
    SELECT
      e.user_id,
      e.api_id,
      e.store_id,
      e.created_at::date AS day,
      COUNT(*)                                   AS calls,
      COUNT(*) FILTER (WHERE e.status >= 400)    AS errors,
      COALESCE(AVG(e.latency_ms), 0)::int        AS avg_latency
    FROM usage_events e
    WHERE e.created_at < CURRENT_DATE
    GROUP BY e.user_id, e.api_id, e.store_id, e.created_at::date
    ON CONFLICT (user_id, api_id, day, COALESCE(store_id, '00000000-0000-0000-0000-000000000000'::uuid))
    DO UPDATE SET
      calls  = usage_daily.calls + EXCLUDED.calls,
      errors = usage_daily.errors + EXCLUDED.errors,
      avg_latency = (usage_daily.avg_latency + EXCLUDED.avg_latency) / 2
    RETURNING day, calls::text
  `;

  const pruned = await sql`
    DELETE FROM usage_events
    WHERE created_at < CURRENT_DATE - (${HOT_WINDOW_DAYS}::text || ' days')::interval
    RETURNING id
  `;

  return { rolledUp: inserted.length, pruned: pruned.length };
}

/**
 * Advance subscriptions whose billing period has ended.
 *
 * Free plans roll over: the allowance resets and the period moves on, which is
 * what "100 calls a month, forever" has to mean. Paid plans expire instead —
 * renewing them requires a payment, and the gateway already refuses anything
 * that is not active.
 *
 * Without this, `used` only ever reset when a payment cleared, so a free plan
 * hit its cap once and stayed capped.
 */
export async function processRenewals() {
  const rolled = await sql<{ id: string }[]>`
    UPDATE subscriptions s
    SET used = 0,
        -- Roll forward by the period the subscription is actually billed on,
        -- so an annual free plan does not reset twelve times a year.
        current_period_end = s.current_period_end +
          (CASE WHEN s.billing_interval = 'annual'
                THEN interval '1 year' ELSE interval '1 month' END),
        updated_at = now()
    FROM plans p
    WHERE p.id = s.plan_id
      AND s.status = 'active'
      AND s.current_period_end IS NOT NULL
      AND s.current_period_end < now()
      AND p.price = 0
    RETURNING s.id
  `;

  const expired = await sql<{ id: string }[]>`
    UPDATE subscriptions s
    SET status = 'expired', updated_at = now()
    FROM plans p
    WHERE p.id = s.plan_id
      AND s.status = 'active'
      AND s.current_period_end IS NOT NULL
      AND s.current_period_end < now()
      AND p.price > 0
    RETURNING s.id
  `;

  return { renewed: rolled.length, expired: expired.length };
}

/**
 * Extend a demonstration account's daily curve so the chart keeps moving.
 *
 * Continues from the last recorded day at a similar volume rather than
 * restarting the ramp, and only fills days that have no row yet.
 */
export async function extendDemoDays() {
  const subs = await sql<{
    id: string;
    user_id: string;
    api_id: string;
    quota: number;
    used: number;
    days_left: number;
  }[]>`
    SELECT id, user_id, api_id, quota, used,
           GREATEST(1, CEIL(EXTRACT(EPOCH FROM (current_period_end - now())) / 86400))::int AS days_left
    FROM subscriptions WHERE demo_traffic = true
  `;

  let filled = 0;

  for (const sub of subs) {
    // Spread what is left across the days left, so generated traffic cannot
    // exhaust the allowance before the period ends. Without this the daily fill
    // used a 7-day average that took no account of the quota at all.
    const perDayBudget = Math.max(
      0,
      Math.floor(Math.max(0, sub.quota - sub.used) / Math.max(1, sub.days_left))
    );

    const recent = await sql<{ store_id: string | null; avg: string; last_day: Date }[]>`
      SELECT store_id, AVG(calls)::bigint::text AS avg, MAX(day) AS last_day
      FROM usage_daily
      WHERE user_id = ${sub.user_id} AND api_id = ${sub.api_id}
        AND day >= CURRENT_DATE - 7
      GROUP BY store_id
    `;
    if (recent.length === 0) continue;

    for (const r of recent) {
      const from = new Date(r.last_day);
      const today = new Date();
      const gapDays = Math.floor((today.getTime() - from.getTime()) / 86_400_000);

      for (let i = 1; i <= Math.min(gapDays, 30); i++) {
        const day = new Date(from.getTime() + i * 86_400_000);
        if (day >= new Date(new Date().toISOString().slice(0, 10))) break;

        const weekday = day.getUTCDay();
        const weekend = weekday === 0 || weekday === 6 ? 0.55 : 1;
        const drift = 1 + Math.sin(day.getTime() / 86_400_000) * 0.15;
        const shaped = Math.max(1, Math.round(Number(r.avg) * weekend * drift));
        // Budget is per subscription; divide it across the stores writing rows.
        const perStore = Math.max(1, Math.floor(perDayBudget / Math.max(1, recent.length)));
        const calls = Math.min(shaped, perStore);

        await sql`
          INSERT INTO usage_daily (user_id, api_id, store_id, day, calls, errors, avg_latency)
          VALUES (${sub.user_id}, ${sub.api_id}, ${r.store_id},
                  ${day.toISOString().slice(0, 10)}, ${calls},
                  ${Math.round(calls * 0.002)}, 160)
          ON CONFLICT (user_id, api_id, day, COALESCE(store_id, '00000000-0000-0000-0000-000000000000'::uuid))
          DO NOTHING
        `;
        filled += 1;
      }
    }
  }

  // The rows just written are what the quota bar reports on.
  await reconcileUsed();

  return { filled };
}

/**
 * Fill the intraday window up to now for a demonstration subscription.
 *
 * Called on read rather than by a scheduler: the five-minute chart needs
 * five-minute freshness, and Vercel's cron granularity is a day. Only the gap
 * since the last event is generated, so a page view costs a handful of rows.
 */
export async function topUpIntraday(userId: string, apiId: string) {
  const [sub] = await sql<{ demo_traffic: boolean }[]>`
    SELECT demo_traffic FROM subscriptions
    WHERE user_id = ${userId} AND api_id = ${apiId} AND status = 'active'
    LIMIT 1
  `;
  if (!sub?.demo_traffic) return { added: 0 };

  const [latest] = await sql<{ at: Date | null }[]>`
    SELECT MAX(created_at) AS at FROM usage_events
    WHERE user_id = ${userId} AND api_id = ${apiId}
  `;

  const now = Date.now();
  const bucketMs = BUCKET_MINUTES * 60_000;

  // Nothing to do if the newest event is inside the current bucket.
  const from = latest?.at ? new Date(latest.at).getTime() : now - 6 * 60 * 60_000;
  if (now - from < bucketMs) return { added: 0 };

  // Cap the catch-up so a page view after a long gap stays cheap.
  const missing = Math.min(Math.floor((now - from) / bucketMs), 96);
  if (missing <= 0) return { added: 0 };

  const stores = await sql<{ id: string }[]>`
    SELECT id FROM stores WHERE user_id = ${userId} ORDER BY created_at
  `;
  const storeIds: (string | null)[] = stores.length ? stores.map((s) => s.id) : [null];

  const keyRows = await sql<{ id: string; store_id: string | null }[]>`
    SELECT id, store_id FROM api_keys WHERE user_id = ${userId} AND revoked_at IS NULL
  `;
  const keyFor = new Map<string | null, string>();
  for (const k of keyRows) keyFor.set(k.store_id, k.id);
  const accountKey = keyFor.get(null) ?? keyRows[0]?.id ?? null;

  const endpoints = ["/stores", "/orders", "/sync/inventory", "/sync/catalog"];
  const rows: Record<string, unknown>[] = [];

  for (let b = 1; b <= missing; b++) {
    const bucketStart = from + b * bucketMs;
    const minuteOfDay = new Date(bucketStart).getUTCHours() * 60 + new Date(bucketStart).getUTCMinutes();

    // Busier through the working day, quiet overnight.
    const daylight = 0.45 + 0.55 * Math.max(0, Math.sin(((minuteOfDay - 300) / 900) * Math.PI));

    storeIds.forEach((storeId, idx) => {
      const share = 1 / (idx + 1.4);
      const wobble = 1 + Math.sin(bucketStart / 400_000 + idx) * 0.4;
      const count = Math.max(0, Math.round(7 * daylight * share * wobble));

      for (let n = 0; n < count; n++) {
        rows.push({
          user_id: userId,
          api_id: apiId,
          api_key_id: keyFor.get(storeId) ?? accountKey,
          store_id: storeId,
          endpoint: `/multistore${endpoints[(b + n) % endpoints.length]}`,
          method: "GET",
          status: Math.random() < 0.015 ? 429 : 200,
          latency_ms: 90 + Math.round(Math.random() * 180),
          created_at: new Date(bucketStart + Math.random() * bucketMs),
        });
      }
    });
  }

  if (rows.length === 0) return { added: 0 };

  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    await sql`
      INSERT INTO usage_events ${sql(
        rows.slice(i, i + BATCH),
        "user_id",
        "api_id",
        "api_key_id",
        "store_id",
        "endpoint",
        "method",
        "status",
        "latency_ms",
        "created_at"
      )}
    `;
  }

  await sql`
    UPDATE api_keys k SET last_used_at = latest.at
    FROM (
      SELECT api_key_id, MAX(created_at) AS at FROM usage_events
      WHERE user_id = ${userId} AND api_key_id IS NOT NULL GROUP BY api_key_id
    ) latest
    WHERE k.id = latest.api_key_id
  `;

  return { added: rows.length };
}

/**
 * Recompute subscriptions.used from the usage actually recorded in the current
 * billing period.
 *
 * `used` was written independently of the usage tables — the traffic generator
 * set it to the lifetime call count clamped to quota, and the daily extension
 * never touched it — so the quota bar and the usage charts were two unrelated
 * numbers describing the same thing, and disagreed.
 *
 * Counted the way the charts count: rolled-up days for finished days, live
 * events for today, so nothing is double counted at the boundary.
 */
export async function reconcileUsed(subscriptionId?: string) {
  const rows = await sql<{ id: string }[]>`
    UPDATE subscriptions s SET
      used = LEAST(s.quota, (
        COALESCE((
          SELECT SUM(d.calls) FROM usage_daily d
          WHERE d.user_id = s.user_id AND d.api_id = s.api_id
            AND d.day >= (
              s.current_period_end - CASE WHEN s.billing_interval = 'annual'
                THEN interval '1 year' ELSE interval '1 month' END
            )::date
            AND d.day < CURRENT_DATE
        ), 0)
        + COALESCE((
          SELECT COUNT(*) FROM usage_events e
          WHERE e.user_id = s.user_id AND e.api_id = s.api_id
            AND e.created_at >= CURRENT_DATE
        ), 0)
      ))::int,
      updated_at = now()
    WHERE s.current_period_end IS NOT NULL
      AND (${subscriptionId ?? null}::uuid IS NULL OR s.id = ${subscriptionId ?? null}::uuid)
    RETURNING s.id
  `;
  return { reconciled: rows.length };
}

/**
 * Calls a demo subscription can generate per day without exhausting its
 * allowance before the period ends.
 *
 * Returns null when there is no ceiling to apply.
 */
export async function dailyDemoBudget(subscriptionId: string): Promise<number | null> {
  const [row] = await sql<{ remaining: number; days_left: number }[]>`
    SELECT GREATEST(0, quota - used)::int AS remaining,
           GREATEST(1, CEIL(EXTRACT(EPOCH FROM (current_period_end - now())) / 86400))::int AS days_left
    FROM subscriptions WHERE id = ${subscriptionId} AND current_period_end IS NOT NULL
  `;
  if (!row) return null;
  return Math.max(0, Math.floor(row.remaining / row.days_left));
}
