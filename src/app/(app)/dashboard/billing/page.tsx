import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getSubscriptions } from "@/server/account";
import { getPaystackConfig } from "@/lib/paystack";
import PlanChooser from "@/components/app/PlanChooser";
import { compact } from "@/lib/utils";
import { formatCurrency } from "@/lib/paystack";

export const dynamic = "force-dynamic";
export const metadata = { title: "Billing" };

export default async function BillingPage() {
  const user = await requireUser();

  const [subs, paystack, invoices] = await Promise.all([
    getSubscriptions(user.id),
    getPaystackConfig(),
    sql<
      {
        invoice_number: string;
        amount: string;
        currency: string;
        paid_at: Date | null;
        api_name: string | null;
      }[]
    >`
      SELECT p.invoice_number, p.amount::text, p.currency, p.paid_at, a.name AS api_name
      FROM payments p
      LEFT JOIN subscriptions s ON s.id = p.subscription_id
      LEFT JOIN apis a ON a.id = s.api_id
      WHERE p.user_id = ${user.id} AND p.status = 'success' AND p.invoice_number IS NOT NULL
      ORDER BY p.paid_at DESC NULLS LAST
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
    (sum, s) => sum + s.planPrice * (s.planUnit ? s.units : 1),
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

      {!paystack.secretKey && (
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
            paymentsEnabled={Boolean(paystack.secretKey)}
          />
        ))
      )}

      <section className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold tracking-tight text-ink">Invoices</h2>
        <p className="mt-1 text-sm text-muted">
          A receipt is emailed automatically after every successful payment. Open one here to view or
          print it.
        </p>

        {invoices.length === 0 ? (
          <p className="mt-5 rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
            No payments yet.
          </p>
        ) : (
          <ul className="mt-5 divide-y divide-line">
            {invoices.map((inv) => (
              <li key={inv.invoice_number} className="flex flex-wrap items-center gap-3 py-3">
                <Link
                  href={`/dashboard/billing/${inv.invoice_number}`}
                  className="font-mono text-xs font-medium text-brand-600 hover:underline"
                >
                  {inv.invoice_number}
                </Link>
                <span className="text-sm text-muted">{inv.api_name ?? "Subscription"}</span>
                <span className="ml-auto text-xs text-muted">
                  {inv.paid_at
                    ? new Date(inv.paid_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "—"}
                </span>
                <span className="w-24 text-right text-sm font-semibold tabular-nums text-ink">
                  {formatCurrency(Math.round(Number(inv.amount) * 100), inv.currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
