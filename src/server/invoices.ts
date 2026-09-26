import "server-only";
import { sql } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { getBranding, emailBrand, renderFooter } from "@/lib/branding";
import { sendEmail, emailShell } from "@/lib/email";
import { renderInvoiceText, type InvoiceDocument } from "@/lib/invoice";
import { renderInvoicePdf } from "@/server/receipt-pdf";
import { formatCurrency } from "@/lib/paystack";
import { priceFor, type BillingInterval } from "@/lib/plans";
import { getTemplates, fillTemplate } from "@/lib/email-templates";
import { appUrl } from "@/lib/app-url";

type PaymentRow = {
  id: string;
  reference: string;
  amount: string;
  currency: string;
  status: string;
  channel: string | null;
  created_at: Date;
  paid_at: Date | null;
  invoice_number: string | null;
  period_start: Date | null;
  period_end: Date | null;
  email: string | null;
  user_name: string | null;
  api_name: string | null;
  plan_name: string | null;
  plan_unit: string | null;
  plan_price: string | null;
  units: number | null;
  billing_interval: string | null;
};

/**
 * Assign an invoice number if the payment does not have one.
 *
 * Drawn from a sequence rather than counting rows: two payments completing at
 * the same moment would otherwise be handed the same number.
 */
export async function ensureInvoiceNumber(paymentId: string): Promise<string> {
  const [row] = await sql<{ invoice_number: string }[]>`
    UPDATE payments
    SET invoice_number = COALESCE(
      invoice_number,
      'ZPH-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('invoice_number_seq')::text, 5, '0')
    )
    WHERE id = ${paymentId}
    RETURNING invoice_number
  `;
  return row.invoice_number;
}

async function loadPayment(reference: string): Promise<PaymentRow | null> {
  const [row] = await sql<PaymentRow[]>`
    SELECT p.id, p.reference, p.amount::text, p.currency, p.status, p.channel,
           p.created_at, p.paid_at, p.invoice_number, p.period_start, p.period_end,
           u.email, u.name AS user_name,
           a.name AS api_name, pl.name AS plan_name, pl.unit AS plan_unit,
           pl.price::text AS plan_price,
           s.units, s.billing_interval
    FROM payments p
    LEFT JOIN users u ON u.id = p.user_id
    LEFT JOIN subscriptions s ON s.id = p.subscription_id
    LEFT JOIN apis a ON a.id = s.api_id
    LEFT JOIN plans pl ON pl.id = s.plan_id
    WHERE p.reference = ${reference}
    LIMIT 1
  `;
  return row ?? null;
}

/** Company identity for the document header, from the admin console. */
async function companyDetails() {
  const settings = await getSettings().catch(() => ({}) as Record<string, string>);
  return {
    name: settings.company_name || settings.platform_name || "Zephiel API",
    address: settings.company_address || "",
    taxId: settings.company_tax_id || null,
    supportEmail: settings.support_email || "support@zephiel.com",
  };
}

/** Currency invoices/receipts are shown in — USD by default (charging is separate). */
async function displayCurrency(): Promise<string> {
  const settings = await getSettings().catch(() => ({}) as Record<string, string>);
  return (settings.invoice_currency || "USD").toUpperCase();
}

export async function buildInvoiceDocument(reference: string): Promise<InvoiceDocument | null> {
  const p = await loadPayment(reference);
  if (!p || !p.email) return null;

  const paid = p.status === "success";
  const chargeCurrency = p.currency; // what Paystack actually took (e.g. NGN)
  const chargedMajor = Number(p.amount); // stored in major units of chargeCurrency
  const qty = p.plan_unit ? (p.units ?? 1) : 1;
  const interval: BillingInterval = p.billing_interval === "annual" ? "annual" : "monthly";
  const planMonthlyUsd = p.plan_price != null ? Number(p.plan_price) : null;

  const wantUsd = (await displayCurrency()) === "USD";

  // Show the document in USD (the canonical plan price) when we can, with a
  // note reconciling it to the naira actually charged. Fall back to the charge
  // currency for legacy rows that have no plan price to price from.
  let currency: string;
  let totalSubunits: number;
  let unitPrice: number;
  let chargedNote: string | null = null;

  if (wantUsd && chargeCurrency !== "USD" && planMonthlyUsd != null && Number.isFinite(planMonthlyUsd)) {
    const perPeriodUsd = priceFor(planMonthlyUsd, interval);
    const usdTotal = perPeriodUsd * qty;
    currency = "USD";
    unitPrice = Math.round(perPeriodUsd * 100);
    totalSubunits = Math.round(usdTotal * 100);

    const rate = usdTotal > 0 ? chargedMajor / usdTotal : null;
    chargedNote =
      `Charged ${formatCurrency(Math.round(chargedMajor * 100), chargeCurrency)}` +
      (rate ? ` (paid in ${chargeCurrency} at $1 = ${formatCurrency(Math.round(rate * 100), chargeCurrency)})` : "");
  } else {
    currency = chargeCurrency;
    totalSubunits = Math.round(chargedMajor * 100);
    unitPrice = qty > 0 ? Math.round(totalSubunits / qty) : totalSubunits;
  }

  const description = [
    p.api_name ?? "Subscription",
    p.plan_name ? `— ${p.plan_name}` : "",
    p.plan_unit && qty > 1 ? `(${qty} ${p.plan_unit}s)` : "",
    `· billed ${interval}`,
  ]
    .filter(Boolean)
    .join(" ");

  const brand = await getBranding();

  return {
    kind: paid ? "receipt" : "invoice",
    invoiceNumber: p.invoice_number ?? (await ensureInvoiceNumber(p.id)),
    receiptNumber: paid ? p.reference.replace(/^zph_/, "").slice(0, 8).toUpperCase() : null,
    issuedAt: p.created_at,
    dueAt: p.created_at,
    paidAt: p.paid_at,
    periodStart: p.period_start,
    periodEnd: p.period_end,
    currency,
    lines: [{ description, qty, unitPrice, amount: totalSubunits }],
    total: totalSubunits,
    chargedNote,
    billTo: { name: p.user_name, email: p.email },
    company: await companyDetails(),
    brand: { logoUrl: brand.logoUrl, color: brand.color },
    payment: paid
      ? {
          method: p.channel ? p.channel.replace(/_/g, " ") : "Card",
          date: p.paid_at ?? p.created_at,
          reference: p.reference,
        }
      : null,
  };
}

/**
 * A one-off invoice not tied to a payment row — for a manual bill an admin
 * issues by hand (e.g. an off-platform arrangement). Document only: nothing is
 * charged and no payment record is created.
 */
export async function buildManualInvoiceDocument(input: {
  to: string;
  name?: string | null;
  amountUsd: number;
  description: string;
  dueInDays?: number;
  /** "receipt" marks it paid; "invoice" leaves an amount due. */
  kind?: "invoice" | "receipt";
}): Promise<InvoiceDocument> {
  const now = new Date();
  const dueAt = new Date(now);
  dueAt.setDate(dueAt.getDate() + (input.dueInDays ?? 14));
  const kind = input.kind ?? "invoice";
  const paid = kind === "receipt";

  const [{ n }] = await sql<{ n: string }[]>`SELECT nextval('invoice_number_seq')::text AS n`;
  const invoiceNumber = `ZPH-${now.getFullYear()}-${n.padStart(5, "0")}`;

  const totalSubunits = Math.round(input.amountUsd * 100);
  const brand = await getBranding();

  return {
    kind,
    invoiceNumber,
    receiptNumber: paid ? invoiceNumber.replace("ZPH-", "R-") : null,
    issuedAt: now,
    dueAt: paid ? null : dueAt,
    paidAt: paid ? now : null,
    currency: "USD",
    lines: [{ description: input.description, qty: 1, unitPrice: totalSubunits, amount: totalSubunits }],
    total: totalSubunits,
    billTo: { name: input.name ?? null, email: input.to },
    company: await companyDetails(),
    brand: { logoUrl: brand.logoUrl, color: brand.color },
    payment: paid ? { method: "Manual", date: now, reference: invoiceNumber } : null,
  };
}

/**
 * Email the receipt for a paid payment, once.
 *
 * receipt_sent_at is claimed with a conditional update before the send, so the
 * browser callback and the webhook — which both activate the same payment and
 * can arrive in either order — cannot each send a copy.
 */
export async function sendReceiptEmail(reference: string): Promise<
  { sent: true } | { sent: false; reason: string }
> {
  const [claimed] = await sql<{ id: string }[]>`
    UPDATE payments SET receipt_sent_at = now()
    WHERE reference = ${reference} AND status = 'success' AND receipt_sent_at IS NULL
    RETURNING id
  `;
  if (!claimed) return { sent: false, reason: "Already sent, or payment is not successful." };

  const doc = await buildInvoiceDocument(reference);
  if (!doc) {
    await sql`UPDATE payments SET receipt_sent_at = NULL WHERE id = ${claimed.id}`;
    return { sent: false, reason: "Payment has no billable account." };
  }

  const [templates, brand] = await Promise.all([getTemplates(), getBranding()]);
  const amount = formatCurrency(doc.total, doc.currency);
  const firstName = doc.billTo.name ? ` ${doc.billTo.name.split(" ")[0]}` : "";
  const t = fillTemplate(templates.receipt, {
    firstName,
    name: doc.billTo.name ?? "",
    company: doc.company.name,
    invoiceNumber: doc.invoiceNumber,
    amount,
  });

  // Attach the receipt as a PDF. Best-effort: a PDF failure must not stop the
  // confirmation email going out.
  let attachments: { filename: string; content: Uint8Array }[] | undefined;
  try {
    const pdf = await renderInvoicePdf(doc);
    attachments = [{ filename: `receipt-${doc.invoiceNumber}.pdf`, content: pdf }];
  } catch (err) {
    console.error("Receipt PDF generation failed:", err);
  }

  const paidOn = new Date(doc.paidAt ?? doc.issuedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const result = await sendEmail({
    to: doc.billTo.email,
    subject: t.subject,
    html: emailShell({
      heading: t.heading,
      intro: t.intro,
      rows: [
        { label: "Description", value: doc.lines[0]?.description ?? "Subscription" },
        { label: "Amount paid", value: `${amount} ${doc.currency}` },
        { label: "Date", value: paidOn },
        { label: "Receipt", value: doc.invoiceNumber },
      ],
      bodyNote: t.note,
      ctaLabel: "View billing",
      ctaHref: `${appUrl()}/dashboard/billing`,
      brand: emailBrand(brand),
      footer: renderFooter(brand),
    }),
    text: `${t.heading}\n\n${t.intro}\n\n${renderInvoiceText(doc)}\n\nView online: ${appUrl()}/dashboard/billing/${doc.invoiceNumber}`,
    attachments,
  });

  if (!result.ok) {
    // Release the claim so a later retry can send it.
    await sql`UPDATE payments SET receipt_sent_at = NULL WHERE id = ${claimed.id}`;
    return { sent: false, reason: result.error };
  }

  return { sent: true };
}

/**
 * A representative document for previewing the layout.
 *
 * Uses the operator's real company details so what they check is what a
 * customer will receive, with obviously fictional customer and amounts so a
 * sample is never mistaken for a real charge.
 */
export async function sampleInvoiceDocument(
  kind: "receipt" | "invoice" = "receipt"
): Promise<InvoiceDocument> {
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const currency = await displayCurrency();
  // A believable per-store price in the display currency (USD by default).
  const unit = currency === "USD" ? 5_00 : 7_750_00;
  const total = unit * 3;

  // Show the reconciliation line on the sample too, so what an operator previews
  // matches what a customer receives.
  const chargedNote =
    currency === "USD"
      ? `Charged ${formatCurrency(Math.round((total / 100) * 1550 * 100), "NGN")} (paid in NGN at $1 = ${formatCurrency(1550_00, "NGN")})`
      : null;

  const brand = await getBranding();

  return {
    kind,
    invoiceNumber: "ZPH-SAMPLE-0000",
    receiptNumber: kind === "receipt" ? "SAMPLE01" : null,
    issuedAt: now,
    dueAt: now,
    paidAt: kind === "receipt" ? now : null,
    periodStart: now,
    periodEnd,
    currency,
    lines: [
      {
        description: "Multistore — Standard (3 stores) · billed monthly",
        qty: 3,
        unitPrice: unit,
        amount: total,
      },
    ],
    total,
    chargedNote,
    billTo: { name: "Sample Customer", email: "customer@example.com" },
    company: await companyDetails(),
    brand: { logoUrl: brand.logoUrl, color: brand.color },
    payment:
      kind === "receipt"
        ? { method: "Card", date: now, reference: "zph_sample_preview" }
        : null,
  };
}
