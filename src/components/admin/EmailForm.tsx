"use client";

import { useActionState } from "react";
import { changeEmail } from "@/server/actions/settings";
import type { FormState } from "@/server/actions/admin";
import { Message, Submit } from "./Form";

export default function EmailForm({ email }: { email: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(changeEmail, null);

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-sm text-muted">
        You sign in with <span className="font-medium text-ink">{email}</span>. Changing it signs out
        every other browser, and the new address is what you use from then on.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-ink">New sign-in address</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="username"
            defaultValue={email}
            className="mt-1.5 w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-ink">Current password</span>
          <input
            name="current"
            type="password"
            required
            autoComplete="current-password"
            className="mt-1.5 w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Submit>Change address</Submit>
        <Message state={state} />
      </div>
    </form>
  );
}
