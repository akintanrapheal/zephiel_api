import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { signOut } from "@/server/actions/auth";

export const metadata: Metadata = { title: { default: "Admin", template: "%s | Zephiel Admin" } };
export const dynamic = "force-dynamic";

const nav = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/apis", label: "APIs" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/subscriptions", label: "Subscriptions" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/users", label: "Users" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  // Every admin page is behind this one check — nothing under /admin renders
  // for a signed-out visitor or a customer account.
  if (!user) redirect("/signin?next=/admin");
  if (user.role !== "admin") redirect("/dashboard");

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-center gap-4 border-b border-line pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Admin</h1>
          <p className="mt-1 text-sm text-muted">
            Signed in as <span className="font-medium text-ink">{user.email}</span>
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/"
            className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-muted transition hover:text-ink"
          >
            View site
          </Link>
          <form action={signOut}>
            <button className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-muted transition hover:text-ink">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="mt-6 lg:grid lg:grid-cols-[200px_1fr] lg:gap-10">
        <aside>
          <nav className="scrollbar-none flex gap-1 overflow-x-auto lg:sticky lg:top-24 lg:flex-col">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:bg-elevated hover:text-ink"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </aside>

        <div className="mt-6 min-w-0 lg:mt-0">{children}</div>
      </div>
    </div>
  );
}
