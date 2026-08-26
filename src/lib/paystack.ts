import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const BASE = "https://api.paystack.co";

export const PAYSTACK_CURRENCY = (process.env.PAYSTACK_CURRENCY ?? "NGN").toUpperCase();

/**
 * Catalog prices are stored in USD. Paystack charges in the account's own
 * currency, so convert unless the account is billing in USD directly.
 */
const USD_TO_NGN = Number(process.env.USD_TO_NGN ?? 1550);

export function secretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not set.");
  return key;
}

export function isConfigured() {
  return Boolean(process.env.PAYSTACK_SECRET_KEY);
}

/**
 * USD price -> the integer subunit amount Paystack expects (kobo for NGN,
 * cents for USD). Paystack rejects non-integer amounts.
 */
export function toSubunits(usd: number) {
  const inCurrency = PAYSTACK_CURRENCY === "USD" ? usd : usd * USD_TO_NGN;
  return Math.round(inCurrency * 100);
}

export function formatCurrency(subunits: number, currency = PAYSTACK_CURRENCY) {
  const major = subunits / 100;
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(major);
  } catch {
    return `${currency} ${major.toLocaleString()}`;
  }
}

type InitializeResult = {
  authorizationUrl: string;
  reference: string;
};

export async function initializeTransaction(params: {
  email: string;
  amountSubunits: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}): Promise<InitializeResult> {
  const res = await fetch(`${BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: params.email,
      amount: params.amountSubunits,
      reference: params.reference,
      currency: PAYSTACK_CURRENCY,
      callback_url: params.callbackUrl,
      metadata: params.metadata ?? {},
    }),
    cache: "no-store",
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.status) {
    throw new Error(body?.message || `Paystack initialize failed (${res.status})`);
  }

  return {
    authorizationUrl: body.data.authorization_url as string,
    reference: body.data.reference as string,
  };
}

export type VerifiedTransaction = {
  status: string;
  amount: number;
  currency: string;
  channel: string | null;
  paidAt: Date | null;
  metadata: Record<string, unknown>;
  raw: unknown;
};

export async function verifyTransaction(reference: string): Promise<VerifiedTransaction> {
  const res = await fetch(`${BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secretKey()}` },
    cache: "no-store",
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.status) {
    throw new Error(body?.message || `Paystack verify failed (${res.status})`);
  }

  const d = body.data;
  return {
    status: d.status,
    amount: d.amount,
    currency: d.currency,
    channel: d.channel ?? null,
    paidAt: d.paid_at ? new Date(d.paid_at) : null,
    metadata: d.metadata ?? {},
    raw: d,
  };
}

/**
 * Paystack signs webhook bodies with HMAC-SHA512 using the secret key.
 * Compare against the raw body text — re-serializing JSON changes the digest.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null) {
  if (!signature) return false;
  const expected = createHmac("sha512", secretKey()).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
