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
 * Extend a demonstration account's daily curve so the chart keeps moving.
 *
 * Continues from the last recorded day at a similar volume rather than
 * restarting the ramp, and only fills days that have no row yet.
 */
export async function extendDemoDays() {
  const subs = await sql<{ user_id: string; api_id: string }[]>`
    SELECT DISTINCT user_id, api_id FROM subscriptions WHERE demo_traffic = true
  `;

  let filled = 0;

  for (const sub of subs) {
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
        const calls = Math.max(1, Math.round(Number(r.avg) * weekend * drift));

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
