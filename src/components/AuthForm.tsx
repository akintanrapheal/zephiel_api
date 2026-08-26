"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signIn, signUp, type AuthState } from "@/server/actions/auth";

export default function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const isSignup = mode === "signup";
  const [state, formAction] = useActionState<AuthState, FormData>(
    isSignup ? signUp : signIn,
    null
  );

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-20">
      <div className="rounded-3xl border border-line bg-surface p-8 shadow-card">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {isSignup ? "Create your free account" : "Welcome back"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          {isSignup
            ? "Every API has a free tier, and your key is issued the moment you sign up."
            : "Sign in to manage your keys, usage, and subscriptions."}
        </p>

        <form action={formAction} className="mt-6 space-y-4">
          {isSignup && (
            <Field label="Full name" type="text" name="name" placeholder="Ada Okoye" autoComplete="name" />
          )}
          <Field label="Work email" type="email" name="email" placeholder="you@company.com" autoComplete="email" />
          <Field
            label="Password"
            type="password"
            name="password"
            minLength={8}
            placeholder="At least 8 characters"
            autoComplete={isSignup ? "new-password" : "current-password"}
          />

          {state?.error && (
            <p className="rounded-xl border border-rose-500/30 bg-rose-500/5 px-4 py-2.5 text-sm text-rose-600">
              {state.error}
            </p>
          )}

          <Submit>{isSignup ? "Create account" : "Sign in"}</Submit>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          {isSignup ? "Already have an account? " : "New to Zephiel? "}
          <Link href={isSignup ? "/signin" : "/signup"} className="font-semibold text-brand-600 hover:text-brand-700">
            {isSignup ? "Sign in" : "Create one free"}
          </Link>
        </p>
      </div>

      <p className="mt-6 text-center text-xs leading-5 text-muted">
        By continuing you agree to our{" "}
        <Link href="/legal/terms" className="underline hover:text-ink">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/legal/terms" className="underline hover:text-ink">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}

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

function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-ink">{label}</span>
      <input
        {...props}
        required
        className="mt-1.5 w-full rounded-xl border border-line bg-bg px-4 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
      />
    </label>
  );
}
