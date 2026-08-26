import Link from "next/link";
import { getCategories } from "@/server/catalog";

const columns = [
  {
    title: "Product",
    links: [
      { href: "/marketplace", label: "Browse APIs" },
      { href: "/pricing", label: "Pricing" },
      { href: "/docs", label: "Documentation" },
      { href: "/dashboard", label: "Dashboard" },
      { href: "/status", label: "Status" },
    ],
  },
  {
    title: "Developers",
    links: [
      { href: "/docs#quickstart", label: "Quickstart" },
      { href: "/docs#authentication", label: "Authentication" },
      { href: "/docs#errors", label: "Error reference" },
      { href: "/docs#sdks", label: "SDKs" },
      { href: "/docs#webhooks", label: "Webhooks" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/providers", label: "Become a provider" },
      { href: "/blog", label: "Blog" },
      { href: "/contact", label: "Contact" },
      { href: "/legal/terms", label: "Terms & Privacy" },
    ],
  },
];

export default async function Footer() {
  const categories = await getCategories();

  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-5">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5 font-semibold tracking-tight">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-[18px] w-[18px]">
                  <path d="M13 3L5 14h6l-2 7 8-11h-6l2-7z" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="text-[15px]">Zephiel API</span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-6 text-muted">
              One key, one bill, one dashboard for every API your product depends on. Ship integrations in
              minutes instead of procurement cycles.
            </p>
            <div className="mt-5 flex gap-2">
              {["GitHub", "X", "LinkedIn"].map((s) => (
                <Link
                  key={s}
                  href="#"
                  className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted transition hover:bg-elevated hover:text-ink"
                >
                  {s}
                </Link>
              ))}
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-ink">{col.title}</h4>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-sm text-muted transition hover:text-ink">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap gap-x-4 gap-y-2 border-t border-line pt-8">
          {categories.map((c) => (
            <Link key={c.slug} href={`/categories/${c.slug}`} className="text-xs text-muted transition hover:text-ink">
              {c.name}
            </Link>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-3 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Zephiel API. All rights reserved.</p>
          <p className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-accent" />
            All systems operational
          </p>
        </div>
      </div>
    </footer>
  );
}
