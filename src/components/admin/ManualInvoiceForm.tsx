"use client";

import { useActionState } from "react";
import { sendManualInvoice } from "@/server/actions/settings";
import type { FormState } from "@/server/actions/admin";
import { Message, Submit } from "./Form";

const field =
  "mt-1.5 w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10";

export default function ManualInvoiceForm() {
  const [state, action] = useActionState<FormState, FormData>(sendManualInvoice, null);

  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-muted">
        Email a one-off invoice for an off-platform arrangement. This is a{" "}
        <span className="font-medium text-ink">document only</span> — nothing is charged and no
        payment is recorded. The amount is entered and shown in US dollars.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-ink">Customer email</span>
          <input name="to" type="email" required placeholder="customer@example.com" className={field} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink">
            Customer name <span className="ml-1 font-normal text-muted">optional</span>
          </span>
          <input name="name" placeholder="Acme Ltd" className={field} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
        <label className="block">
          <span className="text-xs font-semibold text-ink">Amount (USD)</span>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-sm text-muted">$</span>
            <input
              name="amountUsd"
              type="number"
              min="1"
              step="0.01"
              required
              placeholder="200"
              className="w-32 rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
            />
          </div>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink">Due in (days)</span>
          <input
            name="dueInDays"
            type="number"
            min="0"
            max="365"
            defaultValue={14}
            className="mt-1.5 w-28 rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-semibold text-ink">Description</span>
        <input
          name="description"
          required
          placeholder="Multistore — 4 billable stores"
          className={field}
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Submit>Send invoice</Submit>
        <Message state={state} />
      </div>
    </form>
  );
}
