import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import Avatar from "@/components/app/Avatar";
import { signOut } from "@/server/actions/auth";
import ThemeToggle from "@/components/ThemeToggle";
import AppNav from "@/components/app/AppNav";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s | Zephiel" },
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/**
 * Chrome for the signed-in customer area — deliberately separate from the
 * marketing header and footer, which are for visitors deciding whether to
 * sign up rather than people already using the product.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?next=/dashboard");

  // One lookup by primary key; the header renders on every dashboard page.
  const [profile] = await sql<{ avatar_updated_at: Date | null }[]>`
    SELECT avatar_updated_at FROM users WHERE id = ${user.id} LIMIT 1
  `;
  const avatarUpdatedAt = profile?.avatar_updated_at ?? null;

  // Account-action banner: an unpaid invoice (pay to avoid disruption) takes priority, otherwise a free
  // SANDBOX plan that's exceeded its limit — either over its call allowance (used >= quota) or running
  // more connected stores than the free sandbox allows (DEFAULT_FREE_STORE_LIMIT = 1, so units > 1).
  const [flags] = await sql<{ unpaid: number; sandbox_exceeded: number }[]>`
    SELECT
      (SELECT count(*) FROM payments
         WHERE user_id = ${user.id} AND invoice_number IS NOT NULL AND status <> 'success')::int AS unpaid,
      (SELECT count(*) FROM subscriptions s JOIN plans p ON p.id = s.plan_id
         WHERE s.user_id = ${user.id} AND s.status = 'active' AND p.price = 0
           AND (s.used >= s.quota OR s.units > 1))::int AS sandbox_exceeded
  `;
  const showUnpaid = (flags?.unpaid ?? 0) > 0;
  const showUpgrade = !showUnpaid && (flags?.sandbox_exceeded ?? 0) > 0;

  return (
    <div className="min-h-screen bg-bg">
      <a href="#app-main" className="skip-link">
        Skip to content
      </a>

      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden className="h-[17px] w-[17px]">
                <path d="M13 3L5 14h6l-2 7 8-11h-6l2-7z" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="hidden text-[15px] font-semibold tracking-tight text-ink sm:block">
              Zephiel
            </span>
          </Link>

          <AppNav />

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/marketplace"
              className="hidden rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted transition hover:text-ink sm:block"
            >
              Browse APIs
            </Link>
            {user.role === "admin" && (
              <Link
                href="/admin"
                className="hidden rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted transition hover:text-ink md:block"
              >
                Admin
              </Link>
            )}
            <Link href="/dashboard/profile" title={`${user.email} — edit profile`}>
              <Avatar
                userId={user.id}
                name={user.name}
                email={user.email}
                updatedAt={avatarUpdatedAt}
                size={32}
                className="text-xs"
              />
            </Link>
            <form action={signOut}>
              <button className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted transition hover:text-ink">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      {(showUnpaid || showUpgrade) && (
        <div className="bg-orange-500 text-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-sm sm:px-6">
            <p className="flex items-center gap-2 font-semibold">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="h-4 w-4 shrink-0">
                <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {showUnpaid
                ? "Action required: You have an unpaid invoice — pay now to avoid service disruption"
                : "Action required: You've exceeded your free sandbox limit — it's time to upgrade"}
            </p>
            <Link
              href="/dashboard/billing"
              className="shrink-0 font-semibold underline underline-offset-2 hover:opacity-90"
            >
              {showUnpaid ? "Pay invoice" : "See upgrade options"}
            </Link>
          </div>
        </div>
      )}

      <main id="app-main" tabIndex={-1} className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
