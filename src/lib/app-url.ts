/**
 * The site's canonical origin, without a trailing slash.
 *
 * Resolution order:
 *   APP_URL                        — explicit, server-only (preferred)
 *   NEXT_PUBLIC_APP_URL            — legacy name, still honoured
 *   VERCEL_PROJECT_PRODUCTION_URL  — set automatically by Vercel
 *   http://localhost:3000
 *
 * Only server code reads this, so it deliberately avoids the NEXT_PUBLIC_
 * prefix: that prefix inlines a value into the browser bundle, and Vercel
 * (correctly) warns against marking such a variable sensitive.
 */
export function appUrl() {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;

  const raw =
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    (vercel ? `https://${vercel}` : "http://localhost:3000");

  return raw.replace(/\/$/, "");
}

/**
 * Public base for gateway calls, shown in documentation and code samples.
 *
 * This is a literal rather than `appUrl()` because client components render it
 * too, and it must match the route that actually serves the gateway:
 * /api/v1/{slug}/{path}.
 */
export const GATEWAY_BASE = "https://zephiel.com/api/v1";
