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

      <main id="app-main" tabIndex={-1} className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
