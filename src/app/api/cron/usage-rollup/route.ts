import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { rollupFinishedDays, extendDemoDays, processRenewals, reconcileUsed } from "@/server/usage-maintenance";
import { pruneRateLimits } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorised(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Daily housekeeping: fold finished days into the rollup table, prune the hot
 * table, roll over or expire subscriptions whose period has ended, and extend
 * any demonstration curve so charts keep advancing.
 */
export async function GET(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json(
      { error: process.env.CRON_SECRET ? "Unauthorised" : "CRON_SECRET is not set." },
      { status: 401 }
    );
  }

  const rollup = await rollupFinishedDays();
  const renewals = await processRenewals();
  const demo = await extendDemoDays();
  // Rate-limit buckets are per account and per address, so the table would
  // otherwise grow one row per caller and never shrink.
  const prunedLimits = await pruneRateLimits();
  // Last: rolling up moves calls from usage_events into usage_daily, so `used`
  // is only correct once both sides have settled.
  const reconciled = await reconcileUsed();

  const result = { ...rollup, ...renewals, ...demo, ...reconciled, prunedLimits };
  console.log("Usage rollup:", JSON.stringify(result));
  return NextResponse.json({ ok: true, ...result });
}
