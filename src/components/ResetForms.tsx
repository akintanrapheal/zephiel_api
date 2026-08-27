"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { requestReset, completeReset } from "@/server/actions/reset";
import type { FormState } from "@/server/actions/admin";

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "Please wait..." : children}
    </button>
  );
}

function Message({ state }: { state: FormState }) {
  if (!state) return null;
  return (
    <p
      className={
        state.error
          ? "rounded-xl border border-rose-500/30 bg-rose-500/5 px-4 py-2.5 text-sm text-rose-600"
          : "rounded-xl border border-accent/30 bg-accent/5 px-4 py-2.5 text-sm text-accent"
      }
    >
      {state.error ?? state.ok}
    </p>
  );
}

export function RequestResetForm() {
  const [state, action] = useActionState<FormState, FormData>(requestReset, null);

  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="text-xs font-semibold text-ink">Email</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          autoFocus
          placeholder="you@company.com"
          className="mt-1.5 w-full rounded-xl border border-line bg-bg px-4 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
        />
      </label>

      <Message state={state} />
      <Submit>Send reset link</Submit>

      <p className="text-center text-sm text-muted">
        <Link href="/signin" className="font-semibold text-brand-600 hover:text-brand-700">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

export function CompleteResetForm({ token }: { token: string }) {
  const [state, action] = useActionState<FormState, FormData>(completeReset, null);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      <label className="block">
        <span className="text-xs font-semibold text-ink">New password</span>
        <input
          type="password"
          name="password"
          required
          minLength={12}
          autoComplete="new-password"
          autoFocus
          placeholder="At least 12 characters"
          className="mt-1.5 w-full rounded-xl border border-line bg-bg px-4 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-ink">Confirm new password</span>
        <input
          type="password"
          name="confirm"
          required
          minLength={12}
          autoComplete="new-password"
          className="mt-1.5 w-full rounded-xl border border-line bg-bg px-4 py-2.5 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
        />
      </label>

      <Message state={state} />
      <Submit>Set new password</Submit>
    </form>
  );
}
