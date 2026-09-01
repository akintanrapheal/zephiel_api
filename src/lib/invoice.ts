import "server-only";
import { formatCurrency } from "./paystack";

export type InvoiceLine = {
  description: string;
  qty: number;
  /** Subunits, in the invoice currency. */
  unitPrice: number;
  amount: number;
};

export type InvoiceDocument = {
  /** A receipt is an invoice that has been paid; the layout differs slightly. */
  kind: "invoice" | "receipt";
  invoiceNumber: string;
  receiptNumber?: string | null;
  issuedAt: Date;
  dueAt?: Date | null;
  paidAt?: Date | null;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  currency: string;
  lines: InvoiceLine[];
  /** Subunits. */
  total: number;
  billTo: { name?: string | null; email: string };
  company: { name: string; address: string; taxId?: string | null; supportEmail: string };
  payment?: { method: string; date: Date; reference: string } | null;
};

const day = (d: Date) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The invoice as a self-contained HTML document.
 *
 * Table-based and inline-styled throughout, with no external stylesheet: the
 * same markup has to survive an email client and print to a clean page from a
 * browser, and neither reliably supports anything else.
 */
export function renderInvoiceHtml(doc: InvoiceDocument): string {
  const money = (subunits: number) => formatCurrency(subunits, doc.currency);
  const paid = doc.kind === "receipt";

  const meta: [string, string][] = [
    ["Invoice number", doc.invoiceNumber],
    ...(doc.receiptNumber ? ([["Receipt number", doc.receiptNumber]] as [string, string][]) : []),
    ...(paid && doc.paidAt
      ? ([["Date paid", day(doc.paidAt)]] as [string, string][])
      : ([
          ["Date of issue", day(doc.issuedAt)],
          ["Date due", day(doc.dueAt ?? doc.issuedAt)],
        ] as [string, string][])),
    ...(doc.periodStart && doc.periodEnd
      ? ([["Billing period", `${day(doc.periodStart)} – ${day(doc.periodEnd)}`]] as [string, string][])
      : []),
  ];

  const metaRows = meta
    .map(
      ([k, v]) => `
      <tr>
        <td style="padding:3px 24px 3px 0;color:#0f172a;font-size:13px;font-weight:600;white-space:nowrap;">${esc(k)}</td>
        <td style="padding:3px 0;color:#334155;font-size:13px;">${esc(v)}</td>
      </tr>`
    )
    .join("");

  const lineRows = doc.lines
    .map(
      (l) => `
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid #e8ecf3;color:#0f172a;font-size:13px;">${esc(l.description)}</td>
        <td style="padding:14px 0;border-bottom:1px solid #e8ecf3;color:#334155;font-size:13px;text-align:right;">${l.qty}</td>
        <td style="padding:14px 0 14px 24px;border-bottom:1px solid #e8ecf3;color:#334155;font-size:13px;text-align:right;white-space:nowrap;">${esc(money(l.unitPrice))}</td>
        <td style="padding:14px 0 14px 24px;border-bottom:1px solid #e8ecf3;color:#0f172a;font-size:13px;text-align:right;white-space:nowrap;">${esc(money(l.amount))}</td>
      </tr>`
    )
    .join("");

  const paymentHistory = doc.payment
    ? `
    <h2 style="margin:40px 0 0;font-size:15px;color:#0f172a;">Payment history</h2>
    <table role="presentation" width="100%" style="border-collapse:collapse;margin-top:14px;">
      <tr>
        <td style="padding:0 0 8px;color:#64748b;font-size:11px;">Payment method</td>
        <td style="padding:0 0 8px;color:#64748b;font-size:11px;text-align:right;">Date</td>
        <td style="padding:0 0 8px 24px;color:#64748b;font-size:11px;text-align:right;">Amount paid</td>
        <td style="padding:0 0 8px 24px;color:#64748b;font-size:11px;text-align:right;">Reference</td>
      </tr>
      <tr>
        <td style="padding:12px 0;border-top:1px solid #e8ecf3;color:#0f172a;font-size:13px;">${esc(doc.payment.method)}</td>
        <td style="padding:12px 0;border-top:1px solid #e8ecf3;color:#334155;font-size:13px;text-align:right;">${esc(day(doc.payment.date))}</td>
        <td style="padding:12px 0 12px 24px;border-top:1px solid #e8ecf3;color:#334155;font-size:13px;text-align:right;">${esc(money(doc.total))}</td>
        <td style="padding:12px 0 12px 24px;border-top:1px solid #e8ecf3;color:#64748b;font-size:12px;text-align:right;font-family:ui-monospace,Menlo,Consolas,monospace;">${esc(doc.payment.reference)}</td>
      </tr>
    </table>`
    : "";

  const headline = paid
    ? `${money(doc.total)} paid on ${day(doc.paidAt ?? doc.issuedAt)}`
    : `${money(doc.total)} due ${day(doc.dueAt ?? doc.issuedAt)}`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(doc.kind === "receipt" ? "Receipt" : "Invoice")} ${esc(doc.invoiceNumber)} — ${esc(doc.company.name)}</title>
<style>@page{margin:18mm}@media print{.no-print{display:none!important}body{background:#fff!important}}</style>
</head>
<body style="margin:0;padding:24px;background:#f4f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:14px;border:1px solid #e2e8f0;">
<tr><td style="padding:44px 48px;">

  <table role="presentation" width="100%">
    <tr>
      <td style="vertical-align:top;">
        <h1 style="margin:0;font-size:26px;font-weight:700;color:#0f172a;letter-spacing:-0.5px;">${esc(paid ? "Receipt" : "Invoice")}</h1>
      </td>
      <td style="vertical-align:top;text-align:right;">
        <span style="font-size:19px;font-weight:700;color:#0f172a;letter-spacing:-0.3px;">${esc(doc.company.name)}</span>
      </td>
    </tr>
  </table>

  <table role="presentation" style="margin-top:26px;border-collapse:collapse;">${metaRows}</table>

  <table role="presentation" width="100%" style="margin-top:34px;">
    <tr>
      <td style="vertical-align:top;width:52%;">
        <div style="font-size:13px;font-weight:700;color:#0f172a;">${esc(doc.company.name)}</div>
        <div style="margin-top:6px;font-size:13px;line-height:1.7;color:#475569;white-space:pre-line;">${esc(doc.company.address)}</div>
        <div style="margin-top:6px;font-size:13px;color:#475569;">${esc(doc.company.supportEmail)}</div>
        ${doc.company.taxId ? `<div style="margin-top:6px;font-size:13px;color:#475569;">Tax ID ${esc(doc.company.taxId)}</div>` : ""}
      </td>
      <td style="vertical-align:top;">
        <div style="font-size:13px;font-weight:700;color:#0f172a;">Bill to</div>
        ${doc.billTo.name ? `<div style="margin-top:6px;font-size:13px;color:#475569;">${esc(doc.billTo.name)}</div>` : ""}
        <div style="margin-top:6px;font-size:13px;color:#475569;">${esc(doc.billTo.email)}</div>
      </td>
    </tr>
  </table>

  <h2 style="margin:38px 0 0;font-size:19px;font-weight:700;color:#0f172a;letter-spacing:-0.3px;">${esc(headline)}</h2>
  ${
    doc.periodStart && doc.periodEnd
      ? `<p style="margin:8px 0 0;font-size:13px;color:#64748b;">${esc(doc.company.name)} ${esc(day(doc.periodStart))} – ${esc(day(doc.periodEnd))}</p>`
      : ""
  }

  <table role="presentation" width="100%" style="border-collapse:collapse;margin-top:26px;">
    <tr>
      <td style="padding:0 0 8px;color:#64748b;font-size:11px;">Description</td>
      <td style="padding:0 0 8px;color:#64748b;font-size:11px;text-align:right;">Qty</td>
      <td style="padding:0 0 8px 24px;color:#64748b;font-size:11px;text-align:right;">Unit price</td>
      <td style="padding:0 0 8px 24px;color:#64748b;font-size:11px;text-align:right;">Amount</td>
    </tr>
    ${lineRows}
    <tr>
      <td colspan="2"></td>
      <td style="padding:14px 0 4px 24px;color:#475569;font-size:13px;text-align:right;">Subtotal</td>
      <td style="padding:14px 0 4px 24px;color:#0f172a;font-size:13px;text-align:right;">${esc(money(doc.total))}</td>
    </tr>
    <tr>
      <td colspan="2"></td>
      <td style="padding:4px 0 4px 24px;color:#475569;font-size:13px;text-align:right;">Total</td>
      <td style="padding:4px 0 4px 24px;color:#0f172a;font-size:13px;text-align:right;">${esc(money(doc.total))}</td>
    </tr>
    <tr>
      <td colspan="2"></td>
      <td style="padding:4px 0 0 24px;color:#0f172a;font-size:13px;font-weight:700;text-align:right;">${esc(paid ? "Amount paid" : "Amount due")}</td>
      <td style="padding:4px 0 0 24px;color:#0f172a;font-size:13px;font-weight:700;text-align:right;">${esc(money(doc.total))} ${esc(doc.currency)}</td>
    </tr>
  </table>

  ${paymentHistory}

</td></tr>
</table>
</body></html>`;
}

/** Plain-text fallback, for clients that will not render the HTML part. */
export function renderInvoiceText(doc: InvoiceDocument): string {
  const money = (n: number) => formatCurrency(n, doc.currency);
  const paid = doc.kind === "receipt";

  return [
    `${doc.company.name} — ${paid ? "Receipt" : "Invoice"} ${doc.invoiceNumber}`,
    "",
    paid && doc.paidAt
      ? `${money(doc.total)} paid on ${day(doc.paidAt)}`
      : `${money(doc.total)} due ${day(doc.dueAt ?? doc.issuedAt)}`,
    doc.periodStart && doc.periodEnd
      ? `Billing period: ${day(doc.periodStart)} – ${day(doc.periodEnd)}`
      : "",
    "",
    ...doc.lines.map((l) => `  ${l.description} — ${l.qty} x ${money(l.unitPrice)} = ${money(l.amount)}`),
    "",
    `Total: ${money(doc.total)} ${doc.currency}`,
    doc.payment ? `Paid with ${doc.payment.method} on ${day(doc.payment.date)}` : "",
    "",
    `Billed to ${doc.billTo.email}`,
    `Questions: ${doc.company.supportEmail}`,
  ]
    .filter(Boolean)
    .join("\n");
}
