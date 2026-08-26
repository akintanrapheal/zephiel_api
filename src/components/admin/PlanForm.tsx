"use client";

import { useActionState } from "react";
import { savePlan, type FormState } from "@/server/actions/admin";
import { Check, Field, Message, Submit, TextArea } from "./Form";
import type { Plan } from "@/lib/types";

export default function PlanForm({ apiId, plan }: { apiId: string; plan?: Plan }) {
  const [state, formAction] = useActionState<FormState, FormData>(savePlan, null);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="apiId" value={apiId} />
      {plan?.id && <input type="hidden" name="id" value={plan.id} />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Plan name" name="name" defaultValue={plan?.name} required placeholder="Standard" />
        <Field
          label="Price (USD)"
          name="price"
          type="number"
          step="0.01"
          min="0"
          defaultValue={plan?.price ?? 0}
        />
        <Field
          label="Unit"
          hint="blank = flat monthly"
          name="unit"
          defaultValue={plan?.unit ?? ""}
          placeholder="store"
        />
        <Field
          label="Quota"
          hint="calls included"
          name="quota"
          type="number"
          min="0"
          defaultValue={plan?.quota ?? 100}
        />
        <Field
          label="Requests label"
          name="requests"
          defaultValue={plan?.requests}
          placeholder="10,000 requests/mo"
        />
        <Field
          label="Rate limit label"
          name="rateLimit"
          defaultValue={plan?.rateLimit}
          placeholder="60 req/min"
        />
      </div>

      <TextArea
        label="Features"
        hint="one per line"
        name="features"
        rows={4}
        defaultValue={plan?.features?.join("\n")}
      />

      <Check label="Most popular" name="popular" defaultChecked={plan?.popular ?? false} />

      <div className="flex items-center gap-3">
        <Submit>{plan?.id ? "Save plan" : "Add plan"}</Submit>
        <Message state={state} />
      </div>
    </form>
  );
}
