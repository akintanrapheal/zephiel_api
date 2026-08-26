"use client";

import { useActionState, useState } from "react";
import { savePaystackSettings, testPaystackConnection, removePaystackKey } from "@/server/actions/settings";
import type { FormState } from "@/server/actions/admin";
import { Field, Message, Select, Submit } from "./Form";

export default function PaystackSettingsForm({
  currency,
  usdToNgn,
  hasStoredKey,
}: {
  currency: string;
  usdToNgn: number;
  hasStoredKey: boolean;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(savePaystackSettings, null);
  const [testState, testAction] = useActionState<FormState>(testPaystackConnection, null);
  const [reveal, setReveal] = useState(false);

  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-5">
        <div>
          <label htmlFor="secretKey" className="block text-xs font-semibold text-ink">
            Secret key
            <span className="ml-2 font-normal text-muted">
              {hasStoredKey ? "leave blank to keep the current key" : "sk_test_… or sk_live_…"}
            </span>
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              id="secretKey"
              name="secretKey"
              type={reveal ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              placeholder={hasStoredKey ? "••••••••••••••••••••" : "sk_test_xxxxxxxxxxxxxxxx"}
              aria-describedby="secretKey-help"
              className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-3.5 py-2.5 font-mono text-sm text-ink outline-none transition placeholder:font-sans placeholder:text-muted focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
            />
            <button
              type="button"
              onClick={() => setReveal((v) => !v)}
              aria-pressed={reveal}
              className="shrink-0 rounded-xl border border-line px-3 text-xs font-medium text-muted transition hover:text-ink"
            >
              {reveal ? "Hide" : "Show"}
            </button>
          </div>
          <p id="secretKey-help" className="mt-1.5 text-xs text-muted">
            Verified against Paystack before it is saved, then stored encrypted. It is never shown
            again in full.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Charge currency" name="currency" defaultValue={currency}>
            {["NGN", "GHS", "ZAR", "KES", "USD"].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Field
            label="USD conversion rate"
            hint="ignored when charging in USD"
            name="usdToNgn"
            type="number"
            step="0.01"
            min="0.01"
            defaultValue={usdToNgn}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Submit>Save Paystack settings</Submit>
          <Message state={state} />
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <form action={testAction}>
          <button className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink transition hover:bg-elevated">
            Test connection
          </button>
        </form>

        {hasStoredKey && (
          <form action={removePaystackKey}>
            <button className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-500/5">
              Remove stored key
            </button>
          </form>
        )}

        <Message state={testState} />
      </div>
    </div>
  );
}
