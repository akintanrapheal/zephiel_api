import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { signOut } from "@/server/actions/auth";
import Sidebar from "@/components/admin/Sidebar";
import ThemeToggle from "@/components/ThemeToggle";
import { getAdminNavCounts } from "@/server/admin";
import { getSchemaStatus } from "@/server/schema-status";

export const metadata: Metadata = {
  title: { default: "Console", template: "%s | Zephiel Console" },
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  // One guard covers every page in this group. `/admin/login` sits outside it,
  // so there is no redirect loop.
  if (!user) redirect("/admin/login?error=session");
  if (user.role !== "admin") redirect("/admin/login?error=forbidden");

  const [counts, schema] = await Promise.all([
    getAdminNavCounts().catch(() => ({}) as Record<string, number>),
    getSchemaStatus().catch(() => ({ missingTables: [], missingColumns: [], upToDate: true })),
  ]);

  return (
    <div className="min-h-screen bg-bg">
      <a href="#admin-main" className="skip-link">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4 sm:px-6">
          <Sidebar counts={counts} variant="trigger" />

          <Link href="/admin" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-[17px] w-[17px]">
                <path d="M13 3L5 14h6l-2 7 8-11h-6l2-7z" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="text-[15px] font-semibold tracking-tight text-ink">Zephiel</span>
            <span className="rounded-md border border-line px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
              Console
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/"
              className="hidden rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted transition hover:text-ink sm:block"
            >
              View site
            </Link>
            <div className="hidden items-center gap-2 rounded-lg border border-line py-1 pl-1 pr-3 md:flex">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-brand-600 text-[10px] font-bold uppercase text-white">
                {user.email.slice(0, 1)}
              </span>
              <span className="max-w-[160px] truncate text-xs font-medium text-ink">{user.email}</span>
            </div>
            <form action={signOut}>
              <button className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted transition hover:text-ink">
                Sign out
                <span className="sr-only"> of the admin console</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1400px] gap-8 px-4 py-6 sm:px-6">
        <div className="hidden lg:block">
          <Sidebar counts={counts} variant="rail" />
        </div>
        <main id="admin-main" tabIndex={-1} className="min-w-0 flex-1 pb-16">
          {!schema.upToDate && (
            <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/5 px-4 py-3">
              <p className="flex-1 text-sm text-muted">
                <span className="font-semibold text-ink">The database schema is behind this build.</span>{" "}
                Missing:{" "}
                <code className="font-mono text-xs">
                  {[...schema.missingTables, ...schema.missingColumns].join(", ")}
                </code>
              </p>
              <Link
                href="/admin/settings"
                className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700"
              >
                Run migrations
              </Link>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
