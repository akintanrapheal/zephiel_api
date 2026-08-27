import { requireUser } from "@/lib/auth";
import { getUsageSeries, getUsageByApi } from "@/server/account";
import UsageExplorer from "@/components/app/UsageExplorer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Usage" };

export default async function UsagePage() {
  const user = await requireUser();
  const [series, byApi] = await Promise.all([
    getUsageSeries(user.id, 90),
    getUsageByApi(user.id),
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
    </div>
  );
}
