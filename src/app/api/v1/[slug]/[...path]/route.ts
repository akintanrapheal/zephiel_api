import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { hashApiKey } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * The metered gateway.
 *
 * Authenticates the caller's key, checks they have an active subscription with
 * quota left, records the call, and returns the API's canned response. There
 * are no real upstream providers behind these listings, so the response body is
 * the sample stored on the API — everything around it (auth, quota, metering,
 * rate-limit headers) is real and is what a production gateway would do before
 * proxying.
 */
async function handle(
  request: Request,
  ctx: { params: Promise<{ slug: string; path?: string[] }> }
) {
  const started = Date.now();
  const { slug, path } = await ctx.params;
  const endpointPath = `/${(path ?? []).join("/")}`;

  const presented =
    request.headers.get("x-zephiel-key") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    new URL(request.url).searchParams.get("key");

  if (!presented) {
    return fail(401, "missing_key", "Send your key in the X-Zephiel-Key header.");
  }

  const [key] = await sql<
    { id: string; user_id: string; revoked_at: Date | null; store_id: string | null }[]
  >`
    SELECT id, user_id, revoked_at, store_id
    FROM api_keys WHERE key_hash = ${hashApiKey(presented)} LIMIT 1
  `;

  if (!key || key.revoked_at) {
    return fail(401, "invalid_key", "That key is not valid or has been revoked.");
  }

  const [api] = await sql<{ id: string; name: string; sample_response: string }[]>`
    SELECT id, name, sample_response FROM apis WHERE slug = ${slug} AND published = true LIMIT 1
  `;

  if (!api) return fail(404, "not_found", `No published API with slug "${slug}".`);

  const [sub] = await sql<
    { id: string; status: string; quota: number; used: number; rate_limit: string }[]
  >`
    SELECT s.id, s.status, s.quota, s.used, p.rate_limit
    FROM subscriptions s
    JOIN plans p ON p.id = s.plan_id
    WHERE s.user_id = ${key.user_id} AND s.api_id = ${api.id}
    LIMIT 1
  `;

  if (!sub || sub.status !== "active") {
    return fail(403, "not_subscribed", `You have no active subscription for ${api.name}.`);
  }

  // Per-minute rate limit, parsed from the plan's own label so the number
  // enforced is the number advertised.
  const perMinute = Number(/(\d[\d,]*)\s*(?:req|request)/i.exec(sub.rate_limit)?.[1]?.replace(/,/g, "") ?? 0);

  if (perMinute > 0) {
    const [recent] = await sql<{ c: string }[]>`
      SELECT COUNT(*)::text AS c FROM usage_events
      WHERE api_key_id = ${key.id} AND created_at > now() - interval '1 minute'
    `;

    if (Number(recent.c) >= perMinute) {
      return fail(429, "rate_limited", `Plan rate limit of ${sub.rate_limit} exceeded.`, {
        "X-RateLimit-Limit": String(sub.quota),
        "X-RateLimit-Remaining": String(Math.max(0, sub.quota - sub.used)),
        "Retry-After": "60",
      });
    }
  }

  if (sub.used >= sub.quota) {
    return fail(429, "quota_exceeded", `Monthly quota of ${sub.quota.toLocaleString()} used.`, {
      "X-RateLimit-Limit": String(sub.quota),
      "X-RateLimit-Remaining": "0",
    });
  }

  // Count the call, then record it for the dashboard.
  await sql`UPDATE subscriptions SET used = used + 1, updated_at = now() WHERE id = ${sub.id}`;
  await sql`UPDATE api_keys SET last_used_at = now() WHERE id = ${key.id}`;

  const latency = Date.now() - started;
  await sql`
    INSERT INTO usage_events (user_id, api_id, api_key_id, store_id, endpoint, method, status, latency_ms)
    VALUES (${key.user_id}, ${api.id}, ${key.id}, ${key.store_id}, ${`/${slug}${endpointPath}`},
            ${request.method}, 200, ${latency})
  `;

  let body: unknown;
  try {
    body = JSON.parse(api.sample_response);
  } catch {
    body = { raw: api.sample_response };
  }

  return NextResponse.json(
    { success: true, data: body },
    {
      headers: {
        "X-RateLimit-Limit": String(sub.quota),
        "X-RateLimit-Remaining": String(Math.max(0, sub.quota - sub.used - 1)),
        "X-Zephiel-Latency": `${latency}ms`,
      },
    }
  );
}

function fail(status: number, code: string, message: string, headers: Record<string, string> = {}) {
  return NextResponse.json(
    { success: false, error: { code, message, docs: "https://zephiel.com/docs#errors" } },
    { status, headers }
  );
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
