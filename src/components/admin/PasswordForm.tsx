"use client";

import { useActionState } from "react";
import { changePassword } from "@/server/actions/settings";
import type { FormState } from "@/server/actions/admin";
import { Message, Submit } from "./Form";

export default function PasswordForm({ email }: { email: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(changePassword, null);

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-sm text-muted">
        Signed in as <span className="font-medium text-ink">{email}</span>. Changing this signs out
        every other browser.
      </p>

      {/* Helps password managers associate the credential with this account. */}
      <input type="hidden" name="username" autoComplete="username" value={email} readOnly />

      <div className="grid gap-4 sm:grid-cols-3">
        <Secret label="Current password" name="current" autoComplete="current-password" />
        <Secret label="New password" name="next" autoComplete="new-password" minLength={12} />
        <Secret label="Confirm new password" name="confirm" autoComplete="new-password" minLength={12} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Submit>Change password</Submit>
        <Message state={state} />
      </div>
    </form>
  );
}

function Secret({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-ink">{label}</span>
      <input
        {...props}
        type="password"
        required
        className="mt-1.5 w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
      />
    </label>
  );
}
