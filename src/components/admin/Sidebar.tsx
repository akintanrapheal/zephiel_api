"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  exact?: boolean;
  badge?: number;
};

export const adminNav: { section: string; items: NavItem[] }[] = [
  {
    section: "Catalog",
    items: [
      { href: "/admin", label: "Overview", icon: "M4 13h6V4H4v9zm0 7h6v-5H4v5zm10 0h6V11h-6v9zm0-16v5h6V4h-6z", exact: true },
      { href: "/admin/apis", label: "APIs", icon: "M8 6l-5 6 5 6M16 6l5 6-5 6" },
      { href: "/admin/categories", label: "Categories", icon: "M4 6h16M4 12h16M4 18h10" },
    ],
  },
  {
    section: "Commerce",
    items: [
      { href: "/admin/subscriptions", label: "Subscriptions", icon: "M4 7h16v12H4zM4 11h16M9 15h6" },
      { href: "/admin/payments", label: "Payments", icon: "M3 10h18M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7zM7 15h4" },
    ],
  },
  {
    section: "People",
    items: [
      { href: "/admin/users", label: "Users", icon: "M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 20v-1a4 4 0 0 0-3-3.87M16 4.13a4 4 0 0 1 0 7.75" },
    ],
  },
  {
    section: "Configuration",
    items: [
      { href: "/admin/settings", label: "Settings", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 8.9 19a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 5 8.9a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9.4a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" },
    ],
  },
];

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

/**
 * `variant="trigger"` renders only the mobile button and its drawer (for the
 * header); `variant="rail"` renders only the persistent desktop column.
 */
export default function Sidebar({
  counts,
  variant = "rail",
}: {
  counts?: Record<string, number>;
  variant?: "trigger" | "rail";
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Escape closes the mobile drawer, as a dialog is expected to.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const links = (
    <nav aria-label="Admin sections" className="space-y-6">
      {adminNav.map((group) => (
        <div key={group.section}>
          <p className="px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-muted/70">
            {group.section}
          </p>
          <ul className="mt-2 space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item);
              const count = counts?.[item.href];
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                      active
                        ? "bg-brand-600 text-white shadow-sm"
                        : "text-muted hover:bg-elevated hover:text-ink"
                    )}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      className={cn("h-[17px] w-[17px] shrink-0", active ? "text-white" : "text-muted group-hover:text-ink")}
                    >
                      <path d={item.icon} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="flex-1 truncate">{item.label}</span>
                    {count !== undefined && (
                      <span
                        className={cn(
                          "rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                          active ? "bg-white/20 text-white" : "bg-elevated text-muted"
                        )}
                      >
                        {count}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  if (variant === "rail") {
    return (
      <aside className="w-56 shrink-0">
        <div className="sticky top-20">{links}</div>
      </aside>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Toggle admin navigation"
        aria-expanded={open}
        className="grid h-9 w-9 place-items-center rounded-lg border border-line text-muted lg:hidden"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[18px] w-[18px]">
          {open ? <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /> : <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />}
        </svg>
      </button>

      {open && (
        <div role="dialog" aria-modal="true" aria-label="Admin navigation" className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 overflow-y-auto border-r border-line bg-surface p-4">
            {links}
          </aside>
        </div>
      )}

    </>
  );
}
