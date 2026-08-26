import { listSubscriptions } from "@/server/admin";
import PageHeader from "@/components/admin/PageHeader";

export const dynamic = "force-dynamic";
export const metadata = { title: "Subscriptions" };

const statusStyles: Record<string, string> = {
  active: "bg-accent/10 text-accent",
  pending: "bg-amber-500/10 text-amber-600",
  cancelled: "bg-elevated text-muted",
  expired: "bg-rose-500/10 text-rose-600",
};

export default async function AdminSubscriptionsPage() {
  const subs = await listSubscriptions();

  return (
    <div>
      <PageHeader title="Subscriptions" description={`${subs.length} record${subs.length === 1 ? "" : "s"}`} />

      {subs.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-5 py-12 text-center text-sm text-muted">
          No subscriptions yet. They appear the moment a customer picks a plan.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[800px] border-collapse text-sm">
              <caption className="sr-only">All subscriptions with plan, spend, usage, and status</caption>
            <thead>
              <tr className="bg-elevated text-left">
                <th scope="col" className="px-5 py-3 font-semibold text-ink">Customer</th>
                <th scope="col" className="px-5 py-3 font-semibold text-ink">API</th>
                <th scope="col" className="px-5 py-3 font-semibold text-ink">Plan</th>
                <th scope="col" className="px-5 py-3 font-semibold text-ink">Monthly</th>
                <th scope="col" className="px-5 py-3 font-semibold text-ink">Usage</th>
                <th scope="col" className="px-5 py-3 font-semibold text-ink">Status</th>
                <th scope="col" className="px-5 py-3 font-semibold text-ink">Renews</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s, i) => {
                const monthly = Number(s.price) * (s.unit ? s.units : 1);
                return (
                  <tr key={s.id} className={i % 2 ? "bg-elevated/40" : "bg-surface"}>
                    <td className="px-5 py-3 text-ink">{s.email}</td>
                    <td className="px-5 py-3 text-muted">{s.api_name}</td>
                    <td className="px-5 py-3 text-muted">
                      {s.plan_name}
                      {s.unit && <span className="text-xs"> × {s.units} {s.unit}s</span>}
                    </td>
                    <td className="px-5 py-3 tabular-nums text-ink">
                      {monthly === 0 ? "Free" : `$${monthly.toLocaleString()}`}
                    </td>
                    <td className="px-5 py-3 tabular-nums text-muted">
                      {s.used.toLocaleString()} / {s.quota.toLocaleString()}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                          statusStyles[s.status] ?? "bg-elevated text-muted"
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted">
                      {s.current_period_end
                        ? new Date(s.current_period_end).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
