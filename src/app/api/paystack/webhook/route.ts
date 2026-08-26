import { NextResponse } from "next/server";
import { verifyWebhookSignature, isConfigured } from "@/lib/paystack";
import { activateFromReference } from "@/server/billing";

export const dynamic = "force-dynamic";

/**
 * Paystack webhook receiver.
 *
 * The signature is computed over the exact bytes Paystack sent, so the body is
 * read as text and only parsed after the signature checks out.
 */
export async function POST(request: Request) {
  if (!isConfigured()) {
    return NextResponse.json({ error: "Payments not configured" }, { status: 503 });
  }

  const raw = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  if (!verifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: { event?: string; data?: { reference?: string } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const reference = event.data?.reference;

  if (event.event === "charge.success" && reference) {
    const result = await activateFromReference(reference);
    if (!result.ok) console.error("Webhook activation failed:", reference, result.reason);
  }

  // Always 200 on a validly signed event — a non-2xx makes Paystack retry, and
  // retrying will not fix an event we simply do not handle.
  return NextResponse.json({ received: true });
}
