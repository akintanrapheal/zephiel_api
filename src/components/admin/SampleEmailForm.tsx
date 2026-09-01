"use client";

import { useActionState } from "react";
import { sendSampleEmail } from "@/server/actions/settings";
import type { FormState } from "@/server/actions/admin";
import { Message, Submit } from "./Form";

const field =
  "mt-1.5 w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10";

export default function SampleEmailForm({ adminEmail }: { adminEmail: string }) {
  const [state, action] = useActionState<FormState, FormData>(sendSampleEmail, null);

  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-muted">
        Sends the real template to any address, rendered by the same code that produces live
        documents — so what arrives is what a customer receives.
      </p>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="text-xs font-semibold text-ink">Send to</span>
          <input
            name="to"
            type="email"
            required
            defaultValue={adminEmail}
            placeholder="you@example.com"
            className={field}
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-ink">Document</span>
          <select name="kind" defaultValue="receipt" className={field}>
            <option value="receipt">Receipt (after payment)</option>
            <option value="invoice">Invoice (amount due)</option>
            <option value="reminder">Renewal reminder</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Submit>Send sample</Submit>
        <a
          href="/admin/settings/preview/receipt"
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium text-brand-600 hover:underline"
        >
          Preview receipt
        </a>
        <a
          href="/admin/settings/preview/invoice"
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium text-brand-600 hover:underline"
        >
          Preview invoice
        </a>
        <Message state={state} />
      </div>

      <p className="text-xs leading-6 text-muted">
        Samples are marked <span className="font-medium text-ink">[Sample]</span> in the subject and
        use a fictional customer, so one is never mistaken for a real charge.
      </p>
    </form>
  );
}
