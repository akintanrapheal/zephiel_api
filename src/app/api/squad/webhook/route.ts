import { NextResponse } from "next/server";
import { verifyWebhookSignature, isConfigured } from "@/lib/squad";
import { activateFromReference } from "@/server/billing";

export const dynamic = "force-dynamic";

const pick = (o: unknown, k: string): unknown =>
  o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined;

/**
 * Squad (by GTCO) webhook receiver.
 *
 * The signature is computed over the exact bytes Squad sent, so the body is read
 * as text and only parsed after the signature checks out. Squad sends the
 * HMAC-SHA512 in `x-squad-encrypted-body` (older docs: `x-squad-signature`).
 *
 * The payload shape varies by version, so we only pull out the transaction ref
 * and hand off to activateFromReference — which independently re-verifies with
 * Squad and is idempotent, so a signed event naming a ref is safe to act on and
 * only a Squad-confirmed success actually activates anything.
 */
export async function POST(request: Request) {
  if (!(await isConfigured())) {
    return NextResponse.json({ error: "Payments not configured" }, { status: 503 });
  }

  const raw = await request.text();
  const signature =
    request.headers.get("x-squad-encrypted-body") ?? request.headers.get("x-squad-signature");

  if (!(await verifyWebhookSignature(raw, signature))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: unknown;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = pick(event, "Body") ?? pick(event, "body") ?? pick(event, "data") ?? {};
  const reference = (pick(event, "transaction_ref") ??
    pick(event, "TransactionRef") ??
    pick(body, "transaction_ref") ??
    pick(body, "transaction_reference")) as string | undefined;

  if (reference) {
    const result = await activateFromReference(String(reference));
    if (!result.ok) console.error("Squad webhook activation failed:", reference, result.reason);
  }

  // Always 200 on a validly signed event — a non-2xx makes Squad retry, and
  // retrying will not fix an event we simply do not handle.
  return NextResponse.json({ received: true });
}
