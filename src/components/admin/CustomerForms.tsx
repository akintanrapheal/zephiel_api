"use client";

import { useActionState } from "react";
import {
  setJoinDate,
  updateSubscription,
  generateDemoTraffic,
  reconcileUsage,
  recordPastPayments,
  fillPeriodUsage,
  clearDemoTraffic,
  setDemoTraffic,
} from "@/server/actions/customers";
import type { FormState } from "@/server/actions/admin";
import { Field, Message, Select, Submit } from "./Form";

export function JoinDateForm({ userId, joined }: { userId: string; joined: string }) {
  const [state, action] = useActionState<FormState, FormData>(setJoinDate, null);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="id" value={userId} />
      <Field
        label="Registration date"
        name="joined"
        type="date"
        defaultValue={joined}
        className="w-48"
      />
      <Submit>Update</Submit>
      <Message state={state} />
    </form>
  );
}

export function SubscriptionForm({
  sub,
  plans,
}: {
  sub: {
    id: string;
    apiName: string;
    planId: string;
    status: string;
    units: number;
    used: number;
    quota: number;
    starts: string;
    ends: string;
  };
  plans: { id: string; name: string; price: number; unit: string | null }[];
}) {
  const [state, action] = useActionState<FormState, FormData>(updateSubscription, null);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={sub.id} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Select label="Plan" name="planId" defaultValue={sub.planId}>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.price === 0 ? "Free" : `$${p.price}${p.unit ? `/${p.unit}` : ""}/mo`}
            </option>
          ))}
        </Select>

        <Select label="Status" name="status" defaultValue={sub.status}>
          {["active", "pending", "cancelled", "expired"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>

        <Field label="Period began" name="starts" type="date" defaultValue={sub.starts} />
        <Field label="Renews on" name="ends" type="date" defaultValue={sub.ends} />
        <Field label="Billable units" name="units" type="number" min="1" defaultValue={sub.units} />
        <Field
          label="Calls used"
          hint={`quota ${sub.quota.toLocaleString()}`}
          name="used"
          type="number"
          min="0"
          defaultValue={sub.used}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Submit>Save {sub.apiName}</Submit>
        <Message state={state} />
      </div>
    </form>
  );
}

export function TrafficForm({
  subscriptionId,
  defaultFrom,
  demoTraffic,
}: {
  subscriptionId: string;
  defaultFrom: string;
  demoTraffic: boolean;
}) {
  const [state, action] = useActionState<FormState, FormData>(generateDemoTraffic, null);

  return (
    <div className="space-y-3">
      <p className="text-xs leading-6 text-muted">
        Writes a growth curve of daily call volume from the start date to today, plus real events for
        the last few hours so the five-minute chart has shape. Replaces any history already generated
        for this API.
      </p>

      <form action={action} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="subscriptionId" value={subscriptionId} />
        <Field label="From" name="from" type="date" defaultValue={defaultFrom} className="w-44" />
        <Field
          label="Total calls"
          name="total"
          type="number"
          min="1"
          defaultValue={7000000}
          className="w-40"
        />
        <Submit>Generate history</Submit>
      </form>

      <form action={setDemoTraffic} className="rounded-xl border border-line bg-bg p-4">
        <input type="hidden" name="subscriptionId" value={subscriptionId} />
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={demoTraffic}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            className="mt-0.5 h-4 w-4 accent-brand-600"
          />
          <span>
            <span className="block text-sm font-medium text-ink">Keep traffic flowing</span>
            <span className="mt-0.5 block text-xs leading-6 text-muted">
              Tops the five-minute window up to the present each time the stores page is opened, and
              extends the daily curve nightly, so the charts never look frozen.
            </span>
          </span>
        </label>
      </form>

      <div className="flex flex-wrap items-center gap-3">
        {/* The daily cron does this too; the button is for when the bar is
            visibly wrong now and waiting a day is not an answer. */}
        <form action={reconcileUsage}>
          <input type="hidden" name="subscriptionId" value={subscriptionId} />
          <button className="text-xs font-medium text-brand-600 hover:underline">
            Recalculate quota from usage
          </button>
        </form>

        <form action={clearDemoTraffic}>
          <input type="hidden" name="subscriptionId" value={subscriptionId} />
          <button className="text-xs font-medium text-rose-600 hover:underline">
            Clear generated history
          </button>
        </form>
        <Message state={state} />
      </div>
    </div>
  );
}

/** Backdated invoices and a quota level, for demonstration accounts. */
export function BillingHistoryForm({ subscriptionId }: { subscriptionId: string }) {
  const [payState, payAction] = useActionState<FormState, FormData>(recordPastPayments, null);
  const [fillState, fillAction] = useActionState<FormState, FormData>(fillPeriodUsage, null);

  return (
    <div className="space-y-4">
      <form action={payAction} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="subscriptionId" value={subscriptionId} />
        <Field label="Past months to invoice" name="months" type="number" min="1" max="24"
          defaultValue={3} className="w-44" />
        <Field label="Paid by" name="method" defaultValue="card" className="w-36" />
        <Submit>Record payments</Submit>
        <Message state={payState} />
      </form>
      <p className="text-xs leading-6 text-muted">
        Writes one paid invoice per past month at the current plan price. References are prefixed{" "}
        <code className="font-mono">demo_</code> so they can never be mistaken for a real Paystack
        transaction.
      </p>

      <form action={fillAction} className="flex flex-wrap items-end gap-3 border-t border-line pt-4">
        <input type="hidden" name="subscriptionId" value={subscriptionId} />
        <Field label="Fill this period to (%)" name="percent" type="number" min="1" max="100"
          defaultValue={90} className="w-44" />
        <Submit>Set usage</Submit>
        <Message state={fillState} />
      </form>
      <p className="text-xs leading-6 text-muted">
        Spreads usage across the days elapsed in the current period so the chart ramps rather than
        spikes, then recalculates the quota bar from it.
      </p>
    </div>
  );
}
