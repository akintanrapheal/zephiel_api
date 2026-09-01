import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { buildInvoiceDocument } from "@/server/invoices";
import { renderInvoiceHtml } from "@/lib/invoice";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invoice" };

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ invoice: string }>;
}) {
  const user = await requireUser();
  const { invoice } = await params;

  // Scoped to the signed-in account: an invoice number is guessable, so
  // ownership is checked in the query rather than after loading the document.
  const [row] = await sql<{ reference: string }[]>`
    SELECT reference FROM payments
    WHERE invoice_number = ${invoice} AND user_id = ${user.id}
    LIMIT 1
  `;
  if (!row) notFound();

  const doc = await buildInvoiceDocument(row.reference);
  if (!doc) notFound();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 no-print">
        <Link href="/dashboard/billing" className="text-sm font-medium text-muted hover:text-ink">
          &larr; Billing
        </Link>
        <span className="ml-auto text-xs text-muted">
          Use your browser&apos;s print dialog to save this as a PDF.
        </span>
      </div>

      {/*
        The document is one self-contained HTML string shared with the emailed
        copy, so the two can never drift. It renders in an iframe rather than
        inline because it carries its own <style> and print rules.
      */}
      <iframe
        title={`Invoice ${doc.invoiceNumber}`}
        srcDoc={renderInvoiceHtml(doc)}
        className="h-[1100px] w-full rounded-2xl border border-line bg-white"
      />
    </div>
  );
}
