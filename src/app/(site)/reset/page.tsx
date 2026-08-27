import type { Metadata } from "next";
import Link from "next/link";
import { CompleteResetForm } from "@/components/ResetForms";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-20">
      <div className="rounded-3xl border border-line bg-surface p-8 shadow-card">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Choose a new password</h1>

        {token ? (
          <>
            <p className="mt-2 text-sm leading-6 text-muted">
              Setting a new password signs you out everywhere else.
            </p>
            <div className="mt-6">
              <CompleteResetForm token={token} />
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm leading-6 text-muted">
              This link is missing its token. Reset links can only be used once and expire after 45
              minutes.
            </p>
            <Link
              href="/forgot"
              className="mt-6 inline-block rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              Request a new link
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
