import type { Metadata } from "next";
import Link from "next/link";
import { activateFromReference } from "@/server/billing";
import { buildInvoiceDocument } from "@/server/invoices";
import { formatCurrency } from "@/lib/squad";

export const metadata: Metadata = { title: "Payment" };
export const dynamic = "force-dynamic";

const day = (d?: Date | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";
const titleCase = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export default async function BillingCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; transaction_ref?: string; trxref?: string }>;
}) {
  const params = await searchParams;
  // Squad appends the transaction reference on redirect (transaction_ref); keep the
  // older names as fallbacks so an in-flight payment link still resolves.
  const reference = params.transaction_ref ?? params.reference ?? params.trxref;

  const result = reference
    ? await activateFromReference(reference)
    : ({ ok: false, reason: "No payment reference was supplied." } as const);

  const success = result.ok;
  const doc = success && reference ? await buildInvoiceDocument(reference) : null;

  // ── Failure state ──────────────────────────────────────────────────────────
  if (!success || !doc) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-28 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-rose-500/10 text-rose-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-7 w-7">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </span>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-ink">Payment not completed</h1>
        <p className="mt-3 text-sm leading-7 text-muted">
          {result.ok === false ? result.reason : "We couldn't confirm this payment."}
        </p>
        {reference && (
          <p className="mt-4 rounded-lg bg-elevated px-3 py-2 font-mono text-xs text-muted">{reference}</p>
        )}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/dashboard/billing" className="rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700">
            Back to billing
          </Link>
        </div>
      </div>
    );
  }

  // ── Success: Stripe/Render-style payment card ───────────────────────────────
  const amount = formatCurrency(doc.total, doc.currency);
  const method = doc.payment?.method ? titleCase(doc.payment.method) : "—";

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-16 sm:py-24">
      {/* Merchant header */}
      <div className="mb-6 flex items-center gap-3">
        {doc.brand?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={doc.brand.logoUrl} alt={doc.company.name} className="h-8 w-auto" />
        ) : (
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            {doc.company.name.charAt(0)}
          </span>
        )}
        <span className="text-lg font-semibold tracking-tight text-ink">{doc.company.name}</span>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-10">
        {/* Icon + status + amount */}
        <div className="flex flex-col items-center text-center">
          <span className="relative grid h-16 w-16 place-items-center rounded-xl bg-elevated text-muted">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-8 w-8">
              <path d="M7 3h7l5 5v13H7z" strokeLinejoin="round" />
              <path d="M9 11h6M9 14h6M9 8h2" strokeLinecap="round" />
            </svg>
            <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-emerald-500 text-white ring-2 ring-surface">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-3.5 w-3.5">
                <path d="M5 12.5l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </span>
          <p className="mt-5 text-sm text-muted">Invoice paid</p>
          <p className="mt-1 text-4xl font-bold tracking-tight text-ink">{amount}</p>
          <Link
            href={`/dashboard/billing/${doc.invoiceNumber}`}
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-muted transition hover:text-ink"
          >
            View invoice and payment details
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>

        {/* Meta rows */}
        <dl className="mt-8 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted">Invoice number</dt>
            <dd className="font-medium text-ink">{doc.invoiceNumber}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted">Payment date</dt>
            <dd className="font-medium text-ink">{day(doc.payment?.date ?? doc.paidAt)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted">Payment method</dt>
            <dd className="font-medium text-ink">{method}</dd>
          </div>
        </dl>

        {/* Download buttons */}
        {reference && (
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <a
              href={`/api/billing/${encodeURIComponent(reference)}?doc=invoice`}
              className="rounded-xl border border-line bg-surface px-5 py-3 text-center text-sm font-semibold text-ink transition hover:bg-elevated"
            >
              Download invoice
            </a>
            <a
              href={`/api/billing/${encodeURIComponent(reference)}`}
              className="rounded-xl bg-ink px-5 py-3 text-center text-sm font-semibold text-surface transition hover:opacity-90"
            >
              Download receipt
            </a>
          </div>
        )}
      </div>

      <div className="mt-6 text-center">
        <Link href="/dashboard" className="text-sm font-medium text-muted transition hover:text-ink">
          Go to dashboard →
        </Link>
      </div>
    </div>
  );
}
