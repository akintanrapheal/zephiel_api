"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { subscribe } from "@/server/actions/subscribe";
import ApiIcon from "@/components/ApiIcon";
import { cn, compact } from "@/lib/utils";
import BillingToggle from "@/components/BillingToggle";
import {
  isContactSales,
  priceFor,
  formatPrice,
  ANNUAL_DISCOUNT_PERCENT,
  type BillingInterval,
} from "@/lib/plans";

type Plan = {
  id: string;
  name: string;
  price: number;
  unit: string | null;
  requests: string;
  rateLimit: string;
  quota: number;
  popular: boolean;
};

export default function PlanChooser({
  subscription,
  plans,
  paymentsEnabled,
}: {
  subscription: {
    apiName: string;
    apiSlug: string;
    apiLogo: string;
    apiColor: string;
    apiIcon: string | null;
    planName: string;
    planUnit: string | null;
    units: number;
    used: number;
    quota: number;
    currentPeriodEnd: string | null;
    billingInterval?: BillingInterval;
  };
  plans: Plan[];
  paymentsEnabled: boolean;
}) {
  const [units, setUnits] = useState(subscription.units);
  const [interval, setInterval] = useState<BillingInterval>(
    subscription.billingInterval ?? "monthly"
  );

  const current = plans.find((p) => p.name === subscription.planName);
  const currentMonthly = (current?.price ?? 0) * (current?.unit ? subscription.units : 1);

  const renews = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <section className="rounded-2xl border border-line bg-surface">
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
        <ApiIcon
          api={{
            logo: subscription.apiLogo,
            color: subscription.apiColor,
            icon: subscription.apiIcon,
          }}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold tracking-tight text-ink">
            {subscription.apiName}
          </h2>
          <p className="truncate text-xs text-muted">
            {subscription.planName}
            {subscription.planUnit && ` · ${subscription.units} ${subscription.planUnit}s`} ·{" "}
            {compact(subscription.used)} of {compact(subscription.quota)} calls used
          </p>
        </div>
        <p className="shrink-0 text-sm font-semibold text-ink">
          {currentMonthly === 0 ? "Free" : `$${currentMonthly.toLocaleString()}/mo`}
        </p>
      </header>

      {subscription.planUnit && (
        <div className="border-b border-line px-5 py-4">
          <label htmlFor={`units-${subscription.apiSlug}`} className="text-xs font-semibold text-ink">
            Connected {subscription.planUnit}s
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <input
              id={`units-${subscription.apiSlug}`}
              type="number"
              min={1}
              max={999}
              value={units}
              onChange={(e) => setUnits(Math.max(1, Number(e.target.value) || 1))}
              className="w-24 rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-brand-400"
            />
            <p className="text-xs text-muted">
              {units === subscription.units ? (
                <>
                  Manage them on the{" "}
                  <Link href="/dashboard/stores" className="font-medium text-brand-600 hover:underline">
                    Stores
                  </Link>{" "}
                  page — the count follows the stores you connect.
                </>
              ) : (
                <>
                  <span className="font-semibold text-ink">
                    ${((current?.price ?? 0) * units).toLocaleString()}/mo
                  </span>{" "}
                  at {units} {subscription.planUnit}s. Choose a plan below to apply it.
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {plans.some((p) => p.price > 0 && !isContactSales(p.name)) && (
        <div className="border-t border-line px-5 pt-5">
          <BillingToggle value={interval} onChange={setInterval} />
          {interval === "annual" && (
            <p className="mt-3 text-center text-xs text-muted">
              Annual plans are charged for ten months, so you save {ANNUAL_DISCOUNT_PERCENT}%.
            </p>
          )}
        </div>
      )}

      <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((p) => {
          const isCurrent = p.name === subscription.planName;
          const billableUnits = p.unit ? units : 1;
          const quoted = isContactSales(p.name);
          const periodTotal = priceFor(p.price, interval) * billableUnits;
          const isUpgrade = p.quota > subscription.quota;
          const blocked = p.price > 0 && !paymentsEnabled;

          return (
            <div
              key={p.id}
              className={cn(
                "flex flex-col rounded-xl border p-4",
                isCurrent ? "border-brand-500 bg-brand-500/[0.04]" : "border-line"
              )}
            >
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-ink">{p.name}</h3>
                {isCurrent && (
                  <span className="rounded-md bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                    Current
                  </span>
                )}
                {!isCurrent && isUpgrade && (
                  <span className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-accent">
                    More calls
                  </span>
                )}
              </div>

              <p className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-semibold tracking-tight text-ink">
                  {quoted ? "Custom" : periodTotal === 0 ? "Free" : formatPrice(periodTotal)}
                </span>
                {!quoted && periodTotal > 0 && (
                  <span className="text-xs text-muted">
                    /{interval === "annual" ? "yr" : "mo"}
                  </span>
                )}
              </p>

              {!quoted && p.unit && p.price > 0 && (
                <p className="text-xs text-muted">
                  ${p.price}/{p.unit} × {billableUnits}
                  {interval === "annual" ? " × 10 months" : ""}
                </p>
              )}

              <dl className="mt-3 flex-1 space-y-1.5 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Calls</dt>
                  <dd className="font-medium text-ink">{compact(p.quota)}/mo</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Rate limit</dt>
                  <dd className="text-right font-medium text-ink">{p.rateLimit}</dd>
                </div>
              </dl>

              {isCurrent ? (
                <p className="mt-4 rounded-lg bg-elevated px-3 py-2 text-center text-xs text-muted">
                  {/* A free tier is not renewed, it resets — and the useful
                      thing to offer there is an upgrade, not a date. */}
                  {p.price === 0
                    ? renews
                      ? `Free — allowance resets ${renews}`
                      : "Free plan"
                    : renews
                      ? `Renews ${renews}`
                      : "Active"}
                </p>
              ) : quoted ? (
                <Link
                  href={`/contact?plan=enterprise&api=${subscription.apiSlug}`}
                  className="mt-4 rounded-lg border border-line px-3 py-2 text-center text-xs font-semibold text-ink transition hover:bg-elevated"
                >
                  Contact sales
                </Link>
              ) : (
                <form action={subscribe} className="mt-4">
                  <input type="hidden" name="planId" value={p.id} />
                  <input type="hidden" name="apiSlug" value={subscription.apiSlug} />
                  <input type="hidden" name="units" value={billableUnits} />
                  <input type="hidden" name="interval" value={interval} />
                  <ChangeButton
                    label={
                      blocked
                        ? "Payments unavailable"
                        : p.price === 0
                          ? "Switch to Free"
                          : isUpgrade
                            ? "Upgrade"
                            : "Switch plan"
                    }
                    disabled={blocked}
                    emphasis={isUpgrade && !blocked}
                  />
                </form>
              )}
            </div>
          );
        })}
      </div>

      <p className="border-t border-line px-5 py-3 text-xs leading-6 text-muted">
        Upgrades take effect as soon as payment clears, and your call allowance changes immediately.
        {subscription.planUnit &&
          " Connecting or removing a store changes the monthly total from your next renewal."}
      </p>
    </section>
  );
}

function ChangeButton({
  label,
  disabled,
  emphasis,
}: {
  label: string;
  disabled: boolean;
  emphasis: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={cn(
        "w-full rounded-lg px-3 py-2 text-xs font-semibold transition disabled:opacity-50",
        emphasis
          ? "bg-brand-600 text-white hover:bg-brand-700"
          : "border border-line text-ink hover:bg-elevated"
      )}
    >
      {pending ? "Working…" : label}
    </button>
  );
}
