import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type RGB } from "pdf-lib";
import type { InvoiceDocument } from "@/lib/invoice";
import { formatCurrency } from "@/lib/paystack";

const INK = rgb(0.06, 0.09, 0.16);
const MUTED = rgb(0.4, 0.45, 0.52);
const LINE = rgb(0.9, 0.92, 0.95);

const PAGE_W = 595.28; // A4 portrait, points
const PAGE_H = 841.89;
const MX = 50; // left/right margin
const RIGHT = PAGE_W - MX;

const day = (d?: Date | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";

/**
 * Helvetica (WinAnsi) can't encode the naira sign or curly punctuation, and
 * pdf-lib throws on an unencodable glyph. Map the ones that turn up in a receipt
 * to safe equivalents and drop anything else outside Latin-1.
 */
function clean(s: string): string {
  return s
    .replace(/₦/g, "NGN ")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/·/g, "-")
    .replace(/[^\x20-\xFF]/g, "");
}

function hexToRgb(hex: string | undefined, fallback: RGB): RGB {
  if (!hex || !/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex)) return fallback;
  let h = hex.slice(1);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/**
 * The receipt/invoice as a self-contained, print-clean PDF.
 *
 * Laid out by hand with pdf-lib (pure JS — no headless browser), so it renders
 * reliably in a serverless function. Returns the PDF bytes.
 */
export async function renderInvoicePdf(doc: InvoiceDocument): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_W, PAGE_H]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const accent = hexToRgb(doc.brand?.color, INK);
  const paid = doc.kind === "receipt";
  const money = (sub: number) => clean(formatCurrency(sub, doc.currency));

  const text = (
    s: string,
    x: number,
    y: number,
    opts: { size?: number; font?: PDFFont; color?: RGB } = {}
  ) => page.drawText(clean(s), { x, y, size: opts.size ?? 10, font: opts.font ?? font, color: opts.color ?? INK });

  const right = (
    s: string,
    xRight: number,
    y: number,
    opts: { size?: number; font?: PDFFont; color?: RGB } = {}
  ) => {
    const f = opts.font ?? font;
    const size = opts.size ?? 10;
    const w = f.widthOfTextAtSize(clean(s), size);
    page.drawText(clean(s), { x: xRight - w, y, size, font: f, color: opts.color ?? INK });
  };

  const hline = (y: number) =>
    page.drawLine({ start: { x: MX, y }, end: { x: RIGHT, y }, thickness: 1, color: LINE });

  let y = PAGE_H - 60;

  // --- header: title left, logo or company name right ---
  text(paid ? "Receipt" : "Invoice", MX, y, { size: 24, font: bold, color: accent });

  let logo: PDFImage | null = null;
  if (doc.brand?.logoUrl) {
    try {
      const res = await fetch(doc.brand.logoUrl, { signal: AbortSignal.timeout(5000) });
      if (res.ok) logo = await pdf.embedPng(new Uint8Array(await res.arrayBuffer()));
    } catch {
      /* fall back to the wordmark */
    }
  }
  if (logo) {
    const h = 30;
    const w = (logo.width / logo.height) * h;
    page.drawImage(logo, { x: RIGHT - w, y: y - 4, width: w, height: h });
  } else {
    right(doc.company.name, RIGHT, y + 4, { size: 14, font: bold });
  }

  y -= 34;

  // --- meta rows ---
  const meta: [string, string][] = [
    ["Invoice number", doc.invoiceNumber],
    ...(doc.receiptNumber ? ([["Receipt number", doc.receiptNumber]] as [string, string][]) : []),
    ...(paid
      ? ([["Date paid", day(doc.paidAt ?? doc.issuedAt)]] as [string, string][])
      : ([
          ["Date of issue", day(doc.issuedAt)],
          ["Date due", day(doc.dueAt ?? doc.issuedAt)],
        ] as [string, string][])),
    ...(doc.periodStart && doc.periodEnd
      ? ([["Billing period", `${day(doc.periodStart)} - ${day(doc.periodEnd)}`]] as [string, string][])
      : []),
  ];
  for (const [k, v] of meta) {
    text(k, MX, y, { size: 9.5, font: bold });
    text(v, MX + 110, y, { size: 9.5, color: MUTED });
    y -= 16;
  }

  y -= 10;

  // --- from / bill-to ---
  const colR = 320;
  const topBlock = y;
  text(doc.company.name, MX, y, { size: 10, font: bold });
  text("Bill to", colR, y, { size: 10, font: bold });
  y -= 15;
  for (const ln of (doc.company.address || "").split("\n").filter(Boolean)) {
    text(ln, MX, y, { size: 9.5, color: MUTED });
    y -= 13;
  }
  if (doc.company.supportEmail) {
    text(doc.company.supportEmail, MX, y, { size: 9.5, color: MUTED });
    y -= 13;
  }
  if (doc.company.taxId) {
    text(`Tax ID ${doc.company.taxId}`, MX, y, { size: 9.5, color: MUTED });
    y -= 13;
  }
  // Bill-to column, drawn from the same top.
  let yb = topBlock - 15;
  if (doc.billTo.name) {
    text(doc.billTo.name, colR, yb, { size: 9.5, color: MUTED });
    yb -= 13;
  }
  text(doc.billTo.email, colR, yb, { size: 9.5, color: MUTED });

  y = Math.min(y, yb) - 22;

  // --- headline ---
  const headline = paid
    ? `${money(doc.total)} paid on ${day(doc.paidAt ?? doc.issuedAt)}`
    : `${money(doc.total)} due ${day(doc.dueAt ?? doc.issuedAt)}`;
  text(headline, MX, y, { size: 16, font: bold });
  y -= 26;

  // --- line-items table ---
  const QTY_X = 380;
  const UNIT_X = 470;
  text("Description", MX, y, { size: 8.5, color: MUTED });
  right("Qty", QTY_X, y, { size: 8.5, color: MUTED });
  right("Unit price", UNIT_X, y, { size: 8.5, color: MUTED });
  right("Amount", RIGHT, y, { size: 8.5, color: MUTED });
  y -= 8;
  hline(y);
  y -= 16;
  for (const l of doc.lines) {
    text(l.description, MX, y, { size: 9.5 });
    right(String(l.qty), QTY_X, y, { size: 9.5, color: MUTED });
    right(money(l.unitPrice), UNIT_X, y, { size: 9.5, color: MUTED });
    right(money(l.amount), RIGHT, y, { size: 9.5 });
    y -= 14;
    hline(y + 4);
  }

  y -= 8;
  right("Subtotal", UNIT_X, y, { size: 9.5, color: MUTED });
  right(money(doc.total), RIGHT, y, { size: 9.5 });
  y -= 16;
  right("Total", UNIT_X, y, { size: 9.5, color: MUTED });
  right(money(doc.total), RIGHT, y, { size: 9.5 });
  y -= 18;
  right(paid ? "Amount paid" : "Amount due", UNIT_X, y, { size: 10.5, font: bold });
  right(`${money(doc.total)} ${doc.currency}`, RIGHT, y, { size: 10.5, font: bold });
  y -= 22;

  if (doc.chargedNote) {
    right(doc.chargedNote, RIGHT, y, { size: 8.5, color: MUTED });
    y -= 20;
  }

  // --- payment history ---
  if (doc.payment) {
    text("Payment history", MX, y, { size: 10, font: bold });
    y -= 16;
    text("Payment method", MX, y, { size: 8.5, color: MUTED });
    right("Date", QTY_X + 20, y, { size: 8.5, color: MUTED });
    right("Amount", UNIT_X + 10, y, { size: 8.5, color: MUTED });
    right("Reference", RIGHT, y, { size: 8.5, color: MUTED });
    y -= 8;
    hline(y);
    y -= 16;
    text(doc.payment.method, MX, y, { size: 9.5 });
    right(day(doc.payment.date), QTY_X + 20, y, { size: 9.5, color: MUTED });
    right(money(doc.total), UNIT_X + 10, y, { size: 9.5, color: MUTED });
    right(doc.payment.reference, RIGHT, y, { size: 8.5, color: MUTED });
    y -= 22;
  }

  // --- footer ---
  text(`Questions? ${doc.company.supportEmail}`, MX, 50, { size: 8.5, color: MUTED });

  return pdf.save();
}
