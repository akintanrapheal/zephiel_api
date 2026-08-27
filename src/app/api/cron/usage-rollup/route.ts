import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { rollupFinishedDays, extendDemoDays } from "@/server/usage-maintenance";

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
 * Daily usage housekeeping: fold finished days into the rollup table, prune the
 * hot table, and extend any demonstration curve so charts keep advancing.
 */
export async function GET(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json(
      { error: process.env.CRON_SECRET ? "Unauthorised" : "CRON_SECRET is not set." },
      { status: 401 }
    );
  }

  const rollup = await rollupFinishedDays();
  const demo = await extendDemoDays();

  console.log("Usage rollup:", JSON.stringify({ ...rollup, ...demo }));
  return NextResponse.json({ ok: true, ...rollup, ...demo });
}
