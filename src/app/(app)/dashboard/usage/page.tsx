import { requireUser } from "@/lib/auth";
import { getUsageSeries, getUsageByApi, getCallerOrigins } from "@/server/account";
import UsageExplorer from "@/components/app/UsageExplorer";
import CallerOrigins from "@/components/app/CallerOrigins";

export const dynamic = "force-dynamic";
export const metadata = { title: "Usage" };

export default async function UsagePage() {
  const user = await requireUser();
  const [series, byApi, origins] = await Promise.all([
    getUsageSeries(user.id, 90),
    getUsageByApi(user.id),
    // Tolerant: the columns arrive with a migration.
    getCallerOrigins(user.id).catch(() => []),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Usage</h1>
        <p className="mt-1 text-sm text-muted">
          Every call your keys have made, metered by the gateway.
        </p>
      </header>

      <UsageExplorer series={series} byApi={byApi} />

      <CallerOrigins origins={origins} />
    </div>
  );
}
