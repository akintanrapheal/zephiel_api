import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getSubscriptions } from "@/server/account";
import { getSquadConfig } from "@/lib/squad";
import PlanChooser from "@/components/app/PlanChooser";
import { compact } from "@/lib/utils";
import { formatCurrency } from "@/lib/squad";
import { billableStoreUnits } from "@/lib/plans";

export const dynamic = "force-dynamic";
export const metadata = { title: "Billing" };

export default async function BillingPage() {
  const user = await requireUser();

  const [subs, squad, invoices] = await Promise.all([
    getSubscriptions(user.id),
    getSquadConfig(),
    sql<
      {
        invoice_number: string;
        amount: string;
        currency: string;
        status: string;
        paid_at: Date | null;
        created_at: Date;
        api_name: string | null;
      }[]
    >`
      SELECT p.invoice_number, p.amount::text, p.currency, p.status, p.paid_at, p.created_at, a.name AS api_name
      FROM payments p
      LEFT JOIN subscriptions s ON s.id = p.subscription_id
      LEFT JOIN apis a ON a.id = s.api_id
      WHERE p.user_id = ${user.id} AND p.invoice_number IS NOT NULL
      ORDER BY COALESCE(p.paid_at, p.created_at) DESC
      LIMIT 50
    `,
  ]);
  const active = subs.filter((s) => s.status === "active");

  const plans = await sql<
    {
      id: string;
      api_id: string;
      api_slug: string;
      name: string;
      price: string;
      unit: string | null;
      requests: string;
      rate_limit: string;
      quota: number;
      popular: boolean;
    }[]
  >`
    SELECT p.id, p.api_id, a.slug AS api_slug, p.name, p.price, p.unit,
           p.requests, p.rate_limit, p.quota, p.popular
    FROM plans p
    JOIN apis a ON a.id = p.api_id
    WHERE p.api_id = ANY(${active.map((s) => s.apiId)})
    ORDER BY p.sort_order
  `;

  const monthlyTotal = active.reduce(
    (sum, s) => sum + s.planPrice * billableStoreUnits(s.planUnit, s.units),
    0
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Billing &amp; plans</h1>
        <p className="mt-1 text-sm text-muted">
          Change plan to raise your call allowance, or connect more stores. Prices update immediately.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">Monthly total</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-ink">
            ${monthlyTotal.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-muted">
            {active.length} active plan{active.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">Included calls</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-ink">
            {compact(active.reduce((sum, s) => sum + s.quota, 0))}
          </p>
          <p className="mt-1 text-xs text-muted">Per month, across all plans</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">Used this period</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-ink">
            {compact(active.reduce((sum, s) => sum + s.used, 0))}
          </p>
          <p className="mt-1 text-xs text-muted">
            {Math.round(
              (active.reduce((sum, s) => sum + s.used, 0) /
                Math.max(1, active.reduce((sum, s) => sum + s.quota, 0))) *
                100
            )}
            % of allowance
          </p>
        </div>
      </section>

      {!squad.secretKey && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-muted">
          <span className="font-semibold text-ink">Card payments are unavailable</span> on this
          deployment, so paid plans cannot be checked out. Free plans still change instantly.
        </p>
      )}

      {active.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-5 py-12 text-center text-sm text-muted">
          No active subscriptions.{" "}
          <Link href="/marketplace" className="font-medium text-brand-600 hover:underline">
            Browse the marketplace
          </Link>{" "}
          to add one.
        </p>
      ) : (
        active.map((s) => (
          <PlanChooser
            key={s.id}
            subscription={{
              apiName: s.apiName,
              apiSlug: s.apiSlug,
              apiLogo: s.apiLogo,
              apiColor: s.apiColor,
              apiIcon: s.apiIcon,
              planName: s.planName,
              planUnit: s.planUnit,
              units: s.units,
              used: s.used,
              quota: s.quota,
              billingInterval: s.billingInterval,
              currentPeriodEnd: s.currentPeriodEnd
                ? new Date(s.currentPeriodEnd).toISOString()
                : null,
            }}
            plans={plans
              .filter((p) => p.api_id === s.apiId)
              .map((p) => ({
                id: p.id,
                name: p.name,
                price: Number(p.price),
                unit: p.unit,
                requests: p.requests,
                rateLimit: p.rate_limit,
                quota: p.quota,
                popular: p.popular,
              }))}
            paymentsEnabled={Boolean(squad.secretKey)}
          />
        ))
      )}

      {/* Invoice history — paid receipts + any unpaid invoices, with a dunning banner. */}
      {(() => {
        const unpaid = invoices.filter((i) => i.status !== "success");
        const fmtDate = (d: Date) =>
          new Date(d).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
        return (
          <section className="rounded-2xl border border-line bg-surface p-6">
            <h2 className="text-sm font-semibold tracking-tight text-ink">Invoice history</h2>
            <p className="mt-1 text-sm text-muted">View or download your past invoices.</p>

            {unpaid.length > 0 && (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-red-600">
                  <span aria-hidden>⊗</span> Unpaid invoices
                </p>
                <p className="mt-1 text-sm text-muted">
                  You have {unpaid.length} unpaid invoice{unpaid.length === 1 ? "" : "s"}. Please pay
                  invoices to avoid service disruption.
                </p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {unpaid.map((inv) => (
                    <Link
                      key={inv.invoice_number}
                      href={`/dashboard/billing/${inv.invoice_number}`}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      {fmtDate(inv.paid_at ?? inv.created_at)} · Pay invoice ↗
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {invoices.length === 0 ? (
              <p className="mt-5 rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
                No invoices yet.
              </p>
            ) : (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                      <th className="py-2 pr-4 font-medium">Date</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 pr-4 text-right font-medium">Total</th>
                      <th className="py-2 pr-4 text-right font-medium">Applied credits</th>
                      <th className="py-2 pr-4 text-right font-medium">Billed total</th>
                      <th className="py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {invoices.map((inv) => {
                      const paid = inv.status === "success";
                      const total = formatCurrency(Math.round(Number(inv.amount) * 100), inv.currency);
                      const credits = formatCurrency(0, inv.currency);
                      return (
                        <tr key={inv.invoice_number}>
                          <td className="py-3 pr-4">
                            <Link
                              href={`/dashboard/billing/${inv.invoice_number}`}
                              className="font-medium text-ink hover:text-brand-600 hover:underline"
                            >
                              {fmtDate(inv.paid_at ?? inv.created_at)}
                            </Link>
                          </td>
                          <td className="py-3 pr-4">
                            {paid ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">
                                ✓ Paid
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600">
                                ⊘ Unpaid
                              </span>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-right tabular-nums text-muted">{total}</td>
                          <td className="py-3 pr-4 text-right tabular-nums text-muted">{credits}</td>
                          <td className="py-3 pr-4 text-right font-semibold tabular-nums text-ink">{total}</td>
                          <td className="py-3 text-right">
                            <Link
                              href={`/dashboard/billing/${inv.invoice_number}`}
                              className="text-xs font-medium text-brand-600 hover:underline"
                            >
                              {paid ? "View" : "Pay invoice ↗"}
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })()}
    </div>
  );
}
