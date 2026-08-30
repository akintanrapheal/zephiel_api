"use client";

import { useActionState, useState } from "react";
import {
  saveEmailSettings,
  sendTestEmail,
  removeEmailKey,
  runRenewalSweep,
} from "@/server/actions/settings";
import type { FormState } from "@/server/actions/admin";
import { Message, Submit } from "./Form";

export default function EmailSettingsForm({
  from,
  hasStoredKey,
  reminderDays,
}: {
  from: string;
  hasStoredKey: boolean;
  reminderDays: readonly number[];
}) {
  const [saveState, saveAction] = useActionState<FormState, FormData>(saveEmailSettings, null);
  const [testState, testAction] = useActionState<FormState>(sendTestEmail, null);
  const [sweepState, sweepAction] = useActionState<FormState>(runRenewalSweep, null);
  const [reveal, setReveal] = useState(false);

  return (
    <div className="space-y-5">
      <form action={saveAction} className="space-y-4">
        <div>
          <label htmlFor="resendKey" className="block text-xs font-semibold text-ink">
            Resend API key
            <span className="ml-2 font-normal text-muted">
              {hasStoredKey ? "leave blank to keep the current key" : "starts re_"}
            </span>
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              id="resendKey"
              name="apiKey"
              type={reveal ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              placeholder={hasStoredKey ? "••••••••••••••••" : "re_xxxxxxxxxxxx"}
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
        </div>

        <label className="block">
          <span className="text-xs font-semibold text-ink">
            From address
            <span className="ml-2 font-normal text-muted">must be a verified sender</span>
          </span>
          <input
            name="from"
            defaultValue={from}
            placeholder="Zephiel API <info@zephiel.com>"
            className="mt-1.5 w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <Submit>Save email settings</Submit>
          <Message state={saveState} />
        </div>
      </form>

      <div className="space-y-3 border-t border-line pt-5">
        <p className="text-xs leading-6 text-muted">
          Reminders go out{" "}
          <span className="font-semibold text-ink">
            {reminderDays.join(", ")} days
          </span>{" "}
          before a subscription&apos;s renewal date, once each per billing period. The daily sweep runs
          at 09:00 UTC; each customer is told that a lapsed plan makes their integration start
          returning 403.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <form action={testAction}>
            <button className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink transition hover:bg-elevated">
              Send test email
            </button>
          </form>

          <form action={sweepAction}>
            <button className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink transition hover:bg-elevated">
              Run reminder sweep now
            </button>
          </form>

          {hasStoredKey && (
            <form action={removeEmailKey}>
              <button className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-500/5">
                Remove key
              </button>
            </form>
          )}
        </div>

        <Message state={testState} />
        <Message state={sweepState} />
      </div>
    </div>
  );
}
