import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getSettings } from "./settings";

const BASE = "https://api.paystack.co";

export type PaystackConfig = {
  secretKey: string | null;
  currency: string;
  usdToNgn: number;
  /** Where the value came from, so the console can show it. */
  source: "settings" | "env" | "none";
};

/**
 * Configuration resolves from the admin console first, then the environment.
 * That lets an operator rotate keys without a redeploy while keeping env vars
 * working for infrastructure-managed deployments.
 */
export async function getPaystackConfig(): Promise<PaystackConfig> {
  const settings = await getSettings().catch(() => ({}) as Record<string, string>);

  const fromSettings = settings.paystack_secret_key;
  const fromEnv = process.env.PAYSTACK_SECRET_KEY;

  const currency = (settings.paystack_currency ?? process.env.PAYSTACK_CURRENCY ?? "NGN").toUpperCase();
  const rate = Number(settings.usd_to_ngn ?? process.env.USD_TO_NGN ?? 1550);

  return {
    secretKey: fromSettings ?? fromEnv ?? null,
    currency,
    usdToNgn: Number.isFinite(rate) && rate > 0 ? rate : 1550,
    source: fromSettings ? "settings" : fromEnv ? "env" : "none",
  };
}

export async function isConfigured() {
  return Boolean((await getPaystackConfig()).secretKey);
}

async function requireSecretKey() {
  const { secretKey } = await getPaystackConfig();
  if (!secretKey) {
    throw new Error("No Paystack secret key configured (admin console → Settings, or PAYSTACK_SECRET_KEY).");
  }
  return secretKey;
}

/**
 * USD price -> the integer subunit amount Paystack expects (kobo for NGN,
 * cents for USD). Paystack rejects non-integer amounts.
 */
export function toSubunits(usd: number, config: Pick<PaystackConfig, "currency" | "usdToNgn">) {
  const inCurrency = config.currency === "USD" ? usd : usd * config.usdToNgn;
  return Math.round(inCurrency * 100);
}

export function formatCurrency(subunits: number, currency = "NGN") {
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

type InitializeResult = { authorizationUrl: string; reference: string };

export async function initializeTransaction(params: {
  email: string;
  amountSubunits: number;
  reference: string;
  callbackUrl: string;
  currency: string;
  metadata?: Record<string, unknown>;
}): Promise<InitializeResult> {
  const res = await fetch(`${BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await requireSecretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: params.email,
      amount: params.amountSubunits,
      reference: params.reference,
      currency: params.currency,
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
    headers: { Authorization: `Bearer ${await requireSecretKey()}` },
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

/** Calls Paystack with the given key to confirm it is live and readable. */
export async function testSecretKey(secretKey: string) {
  const res = await fetch(`${BASE}/transaction/totals`, {
    headers: { Authorization: `Bearer ${secretKey}` },
    cache: "no-store",
  });

  if (res.status === 401) return { ok: false as const, message: "Paystack rejected that key." };

  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.status) {
    return { ok: false as const, message: body?.message || `Paystack returned ${res.status}.` };
  }

  return { ok: true as const, message: "Key accepted by Paystack." };
}

/**
 * Paystack signs webhook bodies with HMAC-SHA512 using the secret key.
 * Compare against the raw body text — re-serializing JSON changes the digest.
 */
export async function verifyWebhookSignature(rawBody: string, signature: string | null) {
  if (!signature) return false;

  const expected = createHmac("sha512", await requireSecretKey()).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
