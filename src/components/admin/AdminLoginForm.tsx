"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { adminSignIn, type AuthState } from "@/server/actions/auth";

export default function AdminLoginForm({ notice }: { notice?: string | null }) {
  const [state, formAction] = useActionState<AuthState, FormData>(adminSignIn, null);
  const message = state?.error ?? notice;

  return (
    <form action={formAction} className="space-y-4">
      <label className="block">
        <span className="text-xs font-semibold text-ink">Email</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          autoFocus
          placeholder="info@zephiel.com"
          className="mt-1.5 w-full rounded-xl border border-line bg-bg px-4 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-ink">Password</span>
        <input
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete="current-password"
          placeholder="••••••••"
          className="mt-1.5 w-full rounded-xl border border-line bg-bg px-4 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
        />
      </label>

      {message && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/5 px-4 py-2.5 text-sm text-rose-600">
          {message}
        </p>
      )}

      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "Signing in..." : "Sign in to console"}
    </button>
  );
}
