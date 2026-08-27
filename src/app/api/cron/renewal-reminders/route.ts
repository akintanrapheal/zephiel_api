import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { sweepRenewalReminders } from "@/server/notifications";
import { isEmailConfigured } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily renewal-reminder sweep.
 *
 * Vercel Cron calls this with an Authorization header carrying CRON_SECRET.
 * Without that secret set the route refuses to run rather than defaulting to
 * open, since it sends mail to real addresses.
 */
function authorised(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;

  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json(
      { error: process.env.CRON_SECRET ? "Unauthorised" : "CRON_SECRET is not set." },
      { status: 401 }
    );
  }

  if (!(await isEmailConfigured())) {
    return NextResponse.json(
      { skipped: true, reason: "No email provider configured — set a Resend key in admin settings." },
      { status: 200 }
    );
  }

  const result = await sweepRenewalReminders();
  console.log("Renewal sweep:", JSON.stringify(result));

  return NextResponse.json({ ok: true, ...result });
}
