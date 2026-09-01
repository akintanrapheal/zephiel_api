import Link from "next/link";
import PageHeader from "@/components/admin/PageHeader";
import SettingsTabs from "@/components/admin/SettingsTabs";

/**
 * Shared chrome for the settings area.
 *
 * The four groups are separate routes rather than anchors on one page: each
 * loads only the data it needs, a link can point at one of them, and the
 * Paystack card no longer re-renders because someone opened the schema panel.
 */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Platform configuration: payments, email, and data."
      />

      <SettingsTabs />

      <p className="rounded-2xl border border-line bg-surface px-5 py-4 text-sm text-muted">
        Looking for your own email, password, or picture? Those live on{" "}
        <Link href="/admin/profile" className="font-medium text-brand-600 hover:underline">
          your profile
        </Link>
        .
      </p>

      {children}
    </div>
  );
}
