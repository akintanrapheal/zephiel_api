"use client";

import { useActionState } from "react";
import { setJoinDate, updateSubscription } from "@/server/actions/customers";
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
