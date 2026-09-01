import { getCurrentUser } from "@/lib/auth";
import { sampleInvoiceDocument } from "@/server/invoices";
import { renderInvoiceHtml } from "@/lib/invoice";

/** Preview a document in the browser without sending anything. */
export async function GET(_request: Request, { params }: { params: Promise<{ kind: string }> }) {
  // Checked rather than delegated to requireAdmin(): that redirects, which a
  // route handler cannot do from here, and the throw surfaced as a 500.
  const user = await getCurrentUser();
  if (user?.role !== "admin") return new Response("Not found", { status: 404 });

  const { kind } = await params;

  if (kind !== "receipt" && kind !== "invoice") {
    return new Response("Unknown document", { status: 404 });
  }

  return new Response(renderInvoiceHtml(await sampleInvoiceDocument(kind)), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
