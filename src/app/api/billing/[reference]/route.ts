import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { buildInvoiceDocument } from "@/server/invoices";
import { renderInvoicePdf } from "@/server/receipt-pdf";

export const dynamic = "force-dynamic";

/**
 * Downloads the invoice or receipt for a payment as a PDF.
 *   GET /api/billing/<reference>            → receipt (proof of payment)
 *   GET /api/billing/<reference>?doc=invoice → invoice (the bill)
 *
 * Scoped to the signed-in account: the payment with this reference must belong
 * to the current user, so one customer can't pull another's document.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ reference: string }> },
) {
  const user = await requireUser();
  const { reference } = await params;
  const wantInvoice = new URL(req.url).searchParams.get("doc") === "invoice";

  const [owned] = await sql<{ id: string }[]>`
    SELECT id FROM payments WHERE reference = ${reference} AND user_id = ${user.id} LIMIT 1
  `;
  if (!owned) return new Response("Not found", { status: 404 });

  const doc = await buildInvoiceDocument(reference);
  if (!doc) return new Response("Not found", { status: 404 });
  if (wantInvoice) doc.kind = "invoice"; // the bill, not the paid receipt

  const bytes = await renderInvoicePdf(doc);
  const label = wantInvoice ? "invoice" : "receipt";
  const fileName = `${label}-${doc.invoiceNumber}.pdf`;

  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
