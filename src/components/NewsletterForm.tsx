"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { subscribeToNewsletter, type SubscribeState } from "@/server/actions/newsletter";

export default function NewsletterForm() {
  const [state, action] = useActionState<SubscribeState, FormData>(subscribeToNewsletter, null);

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-ink">Newsletter</p>
      <p className="mt-3 text-sm leading-6 text-muted">
        Occasional notes on what we have shipped and what we have learned running the platform. No
        more than once a month.
      </p>

      <form action={action} className="mt-4 flex gap-2">
        <label htmlFor="newsletter-email" className="sr-only">
          Email address
        </label>
        <input
          id="newsletter-email"
          type="email"
          name="email"
          required
          placeholder="you@company.com"
          className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink outline-none transition placeholder:text-muted focus:border-brand-400"
        />
        <Submit />
      </form>

      {state && (
        <p
          className={state.error ? "mt-2 text-xs text-rose-600" : "mt-2 text-xs text-accent"}
          aria-live="polite"
        >
          {state.error ?? state.ok}
        </p>
      )}
    </div>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="shrink-0 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "…" : "Subscribe"}
      <span className="sr-only"> to the newsletter</span>
    </button>
  );
}
