"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/stores", label: "Stores" },
  { href: "/dashboard/usage", label: "Usage" },
  { href: "/dashboard/billing", label: "Billing" },
  { href: "/dashboard/keys", label: "API keys" },
  { href: "/dashboard/playground", label: "Playground" },
  { href: "/dashboard/profile", label: "Profile" },
];

// Shown only to an account owner — members can't manage the team.
const teamLink = { href: "/dashboard/team", label: "Team" };

export default function AppNav({ showTeam = false }: { showTeam?: boolean }) {
  const pathname = usePathname();
  const items = showTeam ? [...links, teamLink] : links;

  return (
    <nav aria-label="Dashboard sections" className="scrollbar-none -mx-1 flex gap-1 overflow-x-auto">
      {items.map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition",
              active ? "bg-elevated text-ink" : "text-muted hover:bg-elevated hover:text-ink"
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
