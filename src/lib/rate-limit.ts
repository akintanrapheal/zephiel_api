import "server-only";
import { sql } from "@/lib/db";

export type RateLimitResult = {
  allowed: boolean;
  /** Requests used in the current window, including this one. */
  count: number;
  limit: number;
  /** Seconds until the window rolls over. */
  retryAfter: number;
};

/**
 * Count one request against a fixed window, atomically.
 *
 * The whole thing is a single upsert so two concurrent requests cannot both
 * read a count below the limit and both proceed — the check-then-increment
 * version of this has a race that lets the limit be exceeded under exactly the
 * load it exists to handle.
 *
 * Fixed window rather than sliding: it allows a burst across a boundary, which
 * is an acceptable trade for one statement and no per-request row.
 */
export async function consumeRateLimit(
  bucket: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const [row] = await sql<{ count: number; age: number }[]>`
    INSERT INTO rate_limits (bucket, window_start, count)
    VALUES (${bucket}, now(), 1)
    ON CONFLICT (bucket) DO UPDATE SET
      count = CASE
        WHEN rate_limits.window_start < now() - (${windowSeconds}::text || ' seconds')::interval
        THEN 1 ELSE rate_limits.count + 1 END,
      window_start = CASE
        WHEN rate_limits.window_start < now() - (${windowSeconds}::text || ' seconds')::interval
        THEN now() ELSE rate_limits.window_start END
    RETURNING count, EXTRACT(EPOCH FROM (now() - window_start))::int AS age
  `;

  return {
    allowed: row.count <= limit,
    count: row.count,
    limit,
    retryAfter: Math.max(1, windowSeconds - row.age),
  };
}

/** Drop counters whose window closed long ago. Called from the daily cron. */
export async function pruneRateLimits(olderThanHours = 24) {
  const rows = await sql<{ bucket: string }[]>`
    DELETE FROM rate_limits
    WHERE window_start < now() - (${olderThanHours}::text || ' hours')::interval
    RETURNING bucket
  `;
  return rows.length;
}
