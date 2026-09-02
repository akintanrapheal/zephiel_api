import "server-only";
import { sql } from "@/lib/db";

/**
 * Generates a plausible traffic history for a demonstration account.
 *
 * Two resolutions, matching how the charts read:
 *   - daily rollups from `from` to today, following a growth curve that sums
 *     to `totalCalls`;
 *   - individual usage_events for the last few hours only, so the intraday
 *     five-minute chart has real shape without inserting millions of rows.
 */
export async function generateTraffic(opts: {
  userId: string;
  apiId: string;
  from: Date;
  totalCalls: number;
  liveHours?: number;
}) {
  const { userId, apiId, from, totalCalls, liveHours = 8 } = opts;

  const stores = await sql<{ id: string }[]>`
    SELECT id FROM stores WHERE user_id = ${userId} ORDER BY created_at
  `;
  const storeIds: (string | null)[] = stores.length ? stores.map((s) => s.id) : [null];

  const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const today = new Date();
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);

  // Weight each day: a slow ramp that accelerates, dipping at weekends, with a
  // little deterministic noise so the line is not suspiciously smooth.
  const weights: number[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 86_400_000);
    const progress = i / Math.max(1, days - 1);

    const growth = Math.pow(progress, 1.7) * 0.9 + 0.1;
    const weekday = d.getUTCDay();
    const weekend = weekday === 0 || weekday === 6 ? 0.55 : 1;
    const noise = 1 + Math.sin(i * 1.9) * 0.12 + Math.cos(i * 0.7) * 0.07;

    weights.push(Math.max(0.01, growth * weekend * noise));
  }

  const weightSum = weights.reduce((a, b) => a + b, 0);

  // Build every rollup row first, then insert in batches.
  const rows: {
    day: string;
    storeId: string | null;
    calls: number;
    errors: number;
    latency: number;
  }[] = [];

  let allocated = 0;
  for (let i = 0; i < days; i++) {
    const dayCalls = Math.round((weights[i] / weightSum) * totalCalls);
    allocated += dayCalls;

    const day = new Date(start.getTime() + i * 86_400_000).toISOString().slice(0, 10);

    // Split across stores unevenly — a flagship usually dominates.
    const shares = storeIds.map((_, idx) => 1 / (idx + 1.4));
    const shareSum = shares.reduce((a, b) => a + b, 0);

    storeIds.forEach((storeId, idx) => {
      const calls = Math.round(dayCalls * (shares[idx] / shareSum));
      if (calls === 0) return;
      rows.push({
        day,
        storeId,
        calls,
        errors: Math.round(calls * (0.001 + Math.abs(Math.sin(i * 0.5)) * 0.002)),
        latency: 120 + Math.round(Math.abs(Math.cos(i * 0.3)) * 90),
      });
    });
  }

  // Push any rounding remainder onto the final day so the total is exact.
  const remainder = totalCalls - allocated;
  if (remainder !== 0 && rows.length) rows[rows.length - 1].calls += remainder;

  await sql`DELETE FROM usage_daily WHERE user_id = ${userId} AND api_id = ${apiId}`;

  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    await sql`
      INSERT INTO usage_daily ${sql(
        batch.map((r) => ({
          user_id: userId,
          api_id: apiId,
          store_id: r.storeId,
          day: r.day,
          calls: r.calls,
          errors: r.errors,
          avg_latency: r.latency,
        })),
        "user_id",
        "api_id",
        "store_id",
        "day",
        "calls",
        "errors",
        "avg_latency"
      )}
    `;
  }

  // --- intraday events for the live window ---------------------------------
  await sql`
    DELETE FROM usage_events
    WHERE user_id = ${userId}
      AND api_id = ${apiId}
      AND created_at >= now() - (${liveHours}::text || ' hours')::interval
  `;

  // Each store's events must carry that store's own key, otherwise the traffic
  // contradicts the per-store key model the dashboard presents.
  const keyRows = await sql<{ id: string; store_id: string | null }[]>`
    SELECT id, store_id FROM api_keys WHERE user_id = ${userId} AND revoked_at IS NULL
  `;
  const keyForStore = new Map<string | null, string>();
  for (const k of keyRows) keyForStore.set(k.store_id, k.id);
  const accountKey = keyForStore.get(null) ?? keyRows[0]?.id ?? null;

  const buckets = (liveHours * 60) / 5;
  const events: { storeId: string | null; at: Date; status: number; latency: number }[] = [];

  for (let b = 0; b < buckets; b++) {
    const bucketStart = Date.now() - (buckets - b) * 5 * 60_000;

    storeIds.forEach((storeId, idx) => {
      // Same shape as the daily curve: busier later, and the flagship busiest.
      const ramp = 0.4 + (b / buckets) * 0.9;
      const share = 1 / (idx + 1.4);
      const wobble = 1 + Math.sin(b * 0.8 + idx) * 0.45;
      const count = Math.max(0, Math.round(6 * ramp * share * wobble));

      for (let n = 0; n < count; n++) {
        events.push({
          storeId,
          at: new Date(bucketStart + Math.random() * 5 * 60_000),
          status: Math.random() < 0.015 ? 429 : 200,
          latency: 90 + Math.round(Math.random() * 180),
        });
      }
    });
  }

  const endpoints = ["/stores", "/orders", "/sync/inventory", "/sync/catalog"];

  for (let i = 0; i < events.length; i += BATCH) {
    const batch = events.slice(i, i + BATCH);
    await sql`
      INSERT INTO usage_events ${sql(
        batch.map((e, n) => ({
          user_id: userId,
          api_id: apiId,
          api_key_id: keyForStore.get(e.storeId) ?? accountKey,
          store_id: e.storeId,
          endpoint: `/multistore${endpoints[n % endpoints.length]}`,
          // Marked so real gateway traffic can be told apart from this.
          source: "demo",
          method: "GET",
          status: e.status,
          latency_ms: e.latency,
          created_at: e.at,
        })),
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

  // A key that has served millions of calls cannot read "never used". Set each
  // key's last_used_at from the traffic just written.
  await sql`
    UPDATE api_keys k
    SET last_used_at = latest.at
    FROM (
      SELECT api_key_id, MAX(created_at) AS at
      FROM usage_events
      WHERE user_id = ${userId} AND api_key_id IS NOT NULL
      GROUP BY api_key_id
    ) AS latest
    WHERE k.id = latest.api_key_id
  `;

  // Store keys with no intraday events still served the historical rollups, so
  // date them to the end of that history rather than leaving them blank.
  await sql`
    UPDATE api_keys
    SET last_used_at = ${new Date()}
    WHERE user_id = ${userId} AND revoked_at IS NULL AND last_used_at IS NULL
  `;

  return { days, rollupRows: rows.length, liveEvents: events.length, totalCalls };
}

export async function clearTraffic(userId: string, apiId: string) {
  await sql`DELETE FROM usage_daily WHERE user_id = ${userId} AND api_id = ${apiId}`;
  await sql`DELETE FROM usage_events WHERE user_id = ${userId} AND api_id = ${apiId}`;

  // Leave no key claiming a last-used date the history no longer supports.
  await sql`
    UPDATE api_keys k SET last_used_at = NULL
    WHERE k.user_id = ${userId}
      AND NOT EXISTS (SELECT 1 FROM usage_events e WHERE e.api_key_id = k.id)
  `;
}
