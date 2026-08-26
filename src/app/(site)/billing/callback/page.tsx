import type { Metadata } from "next";
import Link from "next/link";
import { activateFromReference } from "@/server/billing";

export const metadata: Metadata = { title: "Payment" };
export const dynamic = "force-dynamic";

export default async function BillingCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; trxref?: string }>;
}) {
  const params = await searchParams;
  const reference = params.reference ?? params.trxref;

  const result = reference
    ? await activateFromReference(reference)
    : ({ ok: false, reason: "No payment reference was supplied." } as const);

  const success = result.ok;

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-28 text-center">
      <span
        className={
          success
            ? "grid h-14 w-14 place-items-center rounded-full bg-accent/10 text-accent"
            : "grid h-14 w-14 place-items-center rounded-full bg-rose-500/10 text-rose-600"
        }
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-7 w-7">
          {success ? (
            <path d="M4 12.5l5 5L20 6.5" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          )}
        </svg>
      </span>

      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-ink">
        {success ? "Payment confirmed" : "Payment not completed"}
      </h1>

      <p className="mt-3 text-sm leading-7 text-muted">
        {success
          ? "Your subscription is active and your quota has been applied. It is ready to use right now."
          : result.ok === false
            ? result.reason
            : ""}
      </p>

      {reference && (
        <p className="mt-4 rounded-lg bg-elevated px-3 py-2 font-mono text-xs text-muted">{reference}</p>
      )}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/dashboard"
          className="rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          Go to dashboard
        </Link>
        <Link
          href="/marketplace"
          className="rounded-xl border border-line bg-surface px-6 py-3 text-sm font-semibold text-ink transition hover:bg-elevated"
        >
          Back to marketplace
        </Link>
      </div>
    </div>
  );
}
