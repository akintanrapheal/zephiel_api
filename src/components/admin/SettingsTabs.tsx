"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/admin/settings/payments", label: "Payments" },
  { href: "/admin/settings/email", label: "Email & documents" },
  { href: "/admin/settings/platform", label: "Platform" },
  { href: "/admin/settings/data", label: "Data & maintenance" },
];

export default function SettingsTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Settings sections" className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1">
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition",
              active
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-line text-muted hover:border-brand-300 hover:text-brand-600"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
