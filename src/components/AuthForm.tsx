"use client";

import Link from "next/link";
import { useState } from "react";

export default function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const [submitted, setSubmitted] = useState(false);
  const isSignup = mode === "signup";

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-20">
      <div className="rounded-3xl border border-line bg-surface p-8 shadow-card">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {isSignup ? "Create your free account" : "Welcome back"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          {isSignup
            ? "100 free calls per API every month. No credit card required."
            : "Sign in to manage your keys, usage, and subscriptions."}
        </p>

        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          {["GitHub", "Google"].map((p) => (
            <button
              key={p}
              className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-elevated"
            >
              Continue with {p}
            </button>
          ))}
        </div>

        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-line" />
          <span className="text-xs text-muted">or</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(true);
          }}
          className="space-y-4"
        >
          {isSignup && (
            <Field label="Full name" type="text" name="name" placeholder="Ada Okoye" autoComplete="name" />
          )}
          <Field label="Work email" type="email" name="email" placeholder="you@company.com" autoComplete="email" />
          <Field
            label="Password"
            type="password"
            name="password"
            placeholder="At least 12 characters"
            autoComplete={isSignup ? "new-password" : "current-password"}
          />

          {!isSignup && (
            <div className="flex justify-end">
              <Link href="/signin" className="text-xs font-medium text-brand-600 hover:text-brand-700">
                Forgot password?
              </Link>
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            {isSignup ? "Create account" : "Sign in"}
          </button>
        </form>

        {submitted && (
          <p className="mt-4 rounded-xl border border-brand-500/25 bg-brand-500/5 px-4 py-3 text-sm text-muted">
            This is a demo form — connect an auth provider to make it real.
          </p>
        )}

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
