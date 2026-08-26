import { listPayments } from "@/server/admin";
import PageHeader from "@/components/admin/PageHeader";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payments" };

const statusStyles: Record<string, string> = {
  success: "bg-accent/10 text-accent",
  pending: "bg-amber-500/10 text-amber-600",
  failed: "bg-rose-500/10 text-rose-600",
  abandoned: "bg-elevated text-muted",
};

export default async function AdminPaymentsPage() {
  const payments = await listPayments();
  const settled = payments.filter((p) => p.status === "success");
  const total = settled.reduce((sum, p) => sum + Number(p.amount), 0);
  const currency = settled[0]?.currency ?? "NGN";

  return (
    <div>
      <PageHeader
        title="Payments"
        description={`${payments.length} transaction${payments.length === 1 ? "" : "s"} via Paystack`}
        action={
          <span className="rounded-xl border border-line px-4 py-2.5 text-sm text-muted">
            Settled{" "}
            <span className="font-semibold text-ink">
              {currency} {total.toLocaleString()}
            </span>
          </span>
        }
      />

      {payments.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-5 py-12 text-center text-sm text-muted">
          No payments yet. They appear here once a customer checks out a paid plan.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="bg-elevated text-left">
                <th className="px-5 py-3 font-semibold text-ink">Reference</th>
                <th className="px-5 py-3 font-semibold text-ink">Customer</th>
                <th className="px-5 py-3 font-semibold text-ink">API</th>
                <th className="px-5 py-3 font-semibold text-ink">Amount</th>
                <th className="px-5 py-3 font-semibold text-ink">Channel</th>
                <th className="px-5 py-3 font-semibold text-ink">Status</th>
                <th className="px-5 py-3 font-semibold text-ink">Date</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p, i) => (
                <tr key={p.id} className={i % 2 ? "bg-elevated/40" : "bg-surface"}>
                  <td className="px-5 py-3 font-mono text-xs text-muted">{p.reference}</td>
                  <td className="px-5 py-3 text-ink">{p.email ?? "—"}</td>
                  <td className="px-5 py-3 text-muted">{p.api_name ?? "—"}</td>
                  <td className="px-5 py-3 tabular-nums text-ink">
                    {p.currency} {Number(p.amount).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-muted">{p.channel ?? "—"}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                        statusStyles[p.status] ?? "bg-elevated text-muted"
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted">
                    {new Date(p.paid_at ?? p.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
