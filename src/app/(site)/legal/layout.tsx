import Link from "next/link";

const pages = [
  { href: "/legal/terms", label: "Terms & Privacy" },
  { href: "/legal/gdpr", label: "GDPR compliance" },
];

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="lg:grid lg:grid-cols-[200px_1fr] lg:gap-14">
        <aside className="mb-10 lg:mb-0">
          <nav aria-label="Legal documents" className="lg:sticky lg:top-24">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Legal</p>
            <ul className="mt-3 space-y-1">
              {pages.map((p) => (
                <li key={p.href}>
                  <Link
                    href={p.href}
                    className="block rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:bg-elevated hover:text-ink"
                  >
                    {p.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
