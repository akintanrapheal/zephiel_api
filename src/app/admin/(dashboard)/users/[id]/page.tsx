import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { formatCurrency } from "@/lib/paystack";
import { requireAdmin } from "@/lib/auth";
import PageHeader, { Card } from "@/components/admin/PageHeader";
import { JoinDateForm, SubscriptionForm, TrafficForm, BillingHistoryForm } from "@/components/admin/CustomerForms";
import { deleteSubscription } from "@/server/actions/customers";
import { compact } from "@/lib/utils";

export const dynamic = "force-dynamic";

const iso = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const [user] = await sql<
    { id: string; email: string; name: string; role: string; created_at: Date }[]
  >`SELECT id, email, name, role, created_at FROM users WHERE id = ${id} LIMIT 1`;
  if (!user) notFound();

  const subs = await sql<
    {
      id: string;
      api_id: string;
      api_name: string;
      plan_id: string;
      status: string;
      units: number;
      used: number;
      demo_traffic: boolean;
      quota: number;
      starts: Date | null;
      ends: Date | null;
    }[]
  >`
    SELECT s.id, s.api_id, a.name AS api_name, s.plan_id, s.status, s.units, s.used, s.quota, s.demo_traffic,
           s.current_period_start AS starts,
           s.current_period_end AS ends
    FROM subscriptions s
    JOIN apis a ON a.id = s.api_id
    WHERE s.user_id = ${id}
    ORDER BY a.name
  `;

  const plans = await sql<
    { id: string; api_id: string; name: string; price: string; unit: string | null }[]
  >`SELECT id, api_id, name, price, unit FROM plans ORDER BY sort_order`;

  const payments = await sql<
    {
      id: string;
      invoice_number: string | null;
      amount: string;
      currency: string;
      channel: string | null;
      paid_at: Date | null;
      period_start: Date | null;
    }[]
  >`
    SELECT id, invoice_number, amount::text, currency, channel, paid_at, period_start
    FROM payments
    WHERE user_id = ${id} AND status = 'success'
    ORDER BY paid_at DESC NULLS LAST
    LIMIT 50
  `.catch(() => []);

  const [stats] = await sql<{ calls: string; keys: string; stores: string }[]>`
    SELECT
      (SELECT COUNT(*) FROM usage_events WHERE user_id = ${id})::text AS calls,
      (SELECT COUNT(*) FROM api_keys WHERE user_id = ${id} AND revoked_at IS NULL)::text AS keys,
      (SELECT COUNT(*) FROM stores WHERE user_id = ${id})::text AS stores
  `;

  return (
    <div className="space-y-6">
      <PageHeader
        title={user.name || user.email}
        description={`${user.email} · ${user.role} · ${stats.calls} calls · ${stats.keys} active keys · ${stats.stores} stores`}
        breadcrumb={[{ href: "/admin/users", label: "Users" }, { label: user.email }]}
      />

      <Card title="Account" padded>
        <JoinDateForm userId={user.id} joined={iso(user.created_at)} />
        <p className="mt-3 text-xs text-muted">
          Currently registered{" "}
          <span className="font-medium text-ink">
            {new Date(user.created_at).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
          . This is what the customer sees as &ldquo;member since&rdquo;.
        </p>
      </Card>

      {subs.length === 0 ? (
        <Card title="Subscriptions" padded>
          <p className="text-sm text-muted">This account has no subscriptions.</p>
        </Card>
      ) : (
        subs.map((s) => (
          <Card key={s.id} title={s.api_name} padded>
            <SubscriptionForm
              sub={{
                id: s.id,
                apiName: s.api_name,
                planId: s.plan_id,
                status: s.status,
                units: s.units,
                used: s.used,
                quota: s.quota,
                starts: iso(s.starts),
                ends: iso(s.ends),
              }}
              plans={plans
                .filter((p) => p.api_id === s.api_id)
                .map((p) => ({ id: p.id, name: p.name, price: Number(p.price), unit: p.unit }))}
            />

            <div className="mt-5 border-t border-line pt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                Billing history
              </h3>
              <div className="mt-3">
                <BillingHistoryForm subscriptionId={s.id} />
              </div>
            </div>

            <div className="mt-5 border-t border-line pt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                Demonstration traffic
              </h3>
              <div className="mt-3">
                <TrafficForm
                  subscriptionId={s.id}
                  defaultFrom={iso(user.created_at) || "2026-06-02"}
                  demoTraffic={s.demo_traffic}
                />
              </div>
            </div>

            <form action={deleteSubscription} className="mt-4 border-t border-line pt-4">
              <input type="hidden" name="id" value={s.id} />
              <button className="text-xs font-medium text-rose-600 hover:underline">
                Remove this subscription
              </button>
            </form>
          </Card>
        ))
      )}

      <Card title="Payment history" padded>
        {payments.length === 0 ? (
          <p className="text-sm text-muted">No payments recorded for this account.</p>
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">Payments made by this account</caption>
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th scope="col" className="pb-2 font-medium">Invoice</th>
                <th scope="col" className="pb-2 font-medium">Period</th>
                <th scope="col" className="pb-2 font-medium">Method</th>
                <th scope="col" className="pb-2 font-medium">Paid</th>
                <th scope="col" className="pb-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-line/60">
                  <td className="py-2.5 font-mono text-xs text-ink">{p.invoice_number ?? "—"}</td>
                  <td className="py-2.5 text-xs text-muted">
                    {p.period_start
                      ? new Date(p.period_start).toLocaleDateString("en-GB", {
                          month: "short", year: "numeric", timeZone: "UTC",
                        })
                      : "—"}
                  </td>
                  <td className="py-2.5 text-xs capitalize text-muted">{p.channel ?? "—"}</td>
                  <td className="py-2.5 text-xs text-muted">
                    {p.paid_at
                      ? new Date(p.paid_at).toLocaleDateString("en-GB", {
                          day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
                        })
                      : "—"}
                  </td>
                  <td className="py-2.5 text-right text-xs font-semibold tabular-nums text-ink">
                    {formatCurrency(Math.round(Number(p.amount) * 100), p.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Usage" padded>
        <p className="text-sm text-muted">
          <span className="font-semibold text-ink">{compact(Number(stats.calls))}</span> calls recorded
          all time.{" "}
          <Link href="/admin/subscriptions" className="font-medium text-brand-600 hover:underline">
            All subscriptions
          </Link>
        </p>
      </Card>
    </div>
  );
}
