"use client";

import { useActionState, useState } from "react";
import { sendLifecycleEmail } from "@/server/actions/settings";
import type { FormState } from "@/server/actions/admin";
import { Message, Submit } from "./Form";

type Kind = "receipt" | "reminder" | "sandbox" | "paused" | "cancelled";

const field =
  "mt-1.5 w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10";

const KINDS: { value: Kind; label: string; blurb: string }[] = [
  { value: "receipt", label: "Receipt (payment confirmed)", blurb: "A formal receipt document for a payment received." },
  { value: "reminder", label: "Renewal reminder", blurb: "A heads-up that a subscription renews soon." },
  { value: "sandbox", label: "Free sandbox — upgrade reminder", blurb: "Warns a free sandbox is ending soon and to upgrade before calls start failing." },
  { value: "paused", label: "Subscription paused", blurb: "Access paused after a failed payment — asks them to pay the invoice." },
  { value: "cancelled", label: "Subscription cancelled", blurb: "Confirms a cancellation, with a resubscribe link." },
];

export default function LifecycleEmailForm() {
  const [state, action] = useActionState<FormState, FormData>(sendLifecycleEmail, null);
  const [kind, setKind] = useState<Kind>("receipt");

  const meta = KINDS.find((k) => k.value === kind)!;
  const isReceipt = kind === "receipt";
  const isReminder = kind === "reminder";
  const isDated = kind === "reminder" || kind === "sandbox"; // uses "days left"

  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-muted">
        Sends a real, branded message to a customer (not a sample). Reminders, pause and cancel
        notices use your editable template wording; receipts go out as the formal document.
      </p>

      <label className="block">
        <span className="text-xs font-semibold text-ink">Message</span>
        <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as Kind)} className={field}>
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-[11px] text-muted">{meta.blurb}</span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-ink">Customer email</span>
          <input name="to" type="email" required placeholder="customer@example.com" className={field} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink">
            Customer name <span className="ml-1 font-normal text-muted">optional</span>
          </span>
          <input name="name" placeholder="Jane Doe" className={field} />
        </label>
      </div>

      {isReceipt ? (
        <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
          <label className="block">
            <span className="text-xs font-semibold text-ink">Amount paid (USD)</span>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-sm text-muted">$</span>
              <input
                name="amountUsd"
                type="number"
                min="0.01"
                step="0.01"
                required
                placeholder="200"
                className="w-32 rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
              />
            </div>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-ink">What it was for</span>
            <input name="description" required placeholder="Multistore — 4 billable stores" className={field} />
          </label>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-ink">
                API / product <span className="ml-1 font-normal text-muted">optional</span>
              </span>
              <input name="api" placeholder="Multistore" className={field} />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-ink">
                Plan <span className="ml-1 font-normal text-muted">optional</span>
              </span>
              <input name="plan" placeholder="Standard (3 stores)" className={field} />
            </label>
          </div>
          {isDated && (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold text-ink">
                  {isReminder ? "Renews in (days)" : "Sandbox ends in (days)"}
                </span>
                <input name="days" type="number" min="0" max="3650" defaultValue={7} className={field} />
                <span className="mt-1 block text-[11px] text-muted">
                  The date shown to the customer is worked out from this.
                </span>
              </label>
              {isReminder && (
                <label className="block">
                  <span className="text-xs font-semibold text-ink">
                    Amount <span className="ml-1 font-normal text-muted">optional, USD</span>
                  </span>
                  <input name="amountUsd" type="number" min="0" step="0.01" placeholder="15" className={field} />
                </label>
              )}
            </div>
          )}
        </>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Submit>Send message</Submit>
        <Message state={state} />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-3 text-xs">
        <span className="text-muted">Preview (no send):</span>
        {(["receipt", "reminder", "sandbox", "paused", "cancelled"] as const).map((k) => (
          <a
            key={k}
            href={`/admin/settings/preview/${k}`}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-brand-600 hover:underline"
          >
            {k}
          </a>
        ))}
      </div>
    </form>
  );
}
