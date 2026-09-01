import "server-only";
import { sql } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { sendEmail } from "@/lib/email";
import { renderInvoiceHtml, renderInvoiceText, type InvoiceDocument } from "@/lib/invoice";
import { formatCurrency } from "@/lib/paystack";
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

export async function buildInvoiceDocument(reference: string): Promise<InvoiceDocument | null> {
  const p = await loadPayment(reference);
  if (!p || !p.email) return null;

  const paid = p.status === "success";
  const totalSubunits = Math.round(Number(p.amount) * 100);
  const qty = p.plan_unit ? (p.units ?? 1) : 1;
  const unitPrice = qty > 0 ? Math.round(totalSubunits / qty) : totalSubunits;

  const period = p.billing_interval === "annual" ? "annual" : "monthly";
  const description = [
    p.api_name ?? "Subscription",
    p.plan_name ? `— ${p.plan_name}` : "",
    p.plan_unit && qty > 1 ? `(${qty} ${p.plan_unit}s)` : "",
    `· billed ${period}`,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    kind: paid ? "receipt" : "invoice",
    invoiceNumber: p.invoice_number ?? (await ensureInvoiceNumber(p.id)),
    receiptNumber: paid ? p.reference.replace(/^zph_/, "").slice(0, 8).toUpperCase() : null,
    issuedAt: p.created_at,
    dueAt: p.created_at,
    paidAt: p.paid_at,
    periodStart: p.period_start,
    periodEnd: p.period_end,
    currency: p.currency,
    lines: [{ description, qty, unitPrice, amount: totalSubunits }],
    total: totalSubunits,
    billTo: { name: p.user_name, email: p.email },
    company: await companyDetails(),
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

  const result = await sendEmail({
    to: doc.billTo.email,
    subject: `${doc.company.name} receipt ${doc.invoiceNumber} — ${formatCurrency(doc.total, doc.currency)}`,
    html: renderInvoiceHtml(doc),
    text: `${renderInvoiceText(doc)}\n\nView online: ${appUrl()}/dashboard/billing/${doc.invoiceNumber}`,
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

  const settings = await getSettings().catch(() => ({}) as Record<string, string>);
  const currency = (settings.paystack_currency ?? "NGN").toUpperCase();
  const unit = currency === "USD" ? 5000 : 7_750_00;

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
        amount: unit * 3,
      },
    ],
    total: unit * 3,
    billTo: { name: "Sample Customer", email: "customer@example.com" },
    company: await companyDetails(),
    payment:
      kind === "receipt"
        ? { method: "Card", date: now, reference: "zph_sample_preview" }
        : null,
  };
}
