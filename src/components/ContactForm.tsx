"use client";

import { useState } from "react";

const topics = ["General question", "Pricing & plans", "Enterprise / volume", "List my API", "Technical support"];

export default function ContactForm() {
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="rounded-2xl border border-accent/30 bg-accent/5 p-8">
        <h2 className="text-lg font-semibold tracking-tight text-ink">Thanks — message received</h2>
        <p className="mt-2 text-sm leading-7 text-muted">
          This demo form does not send anywhere yet. Wire it to a route handler, a form service, or your
          CRM to make it live.
        </p>
        <button
          onClick={() => setSent(false)}
          className="mt-5 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-elevated"
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSent(true);
      }}
      className="space-y-5 rounded-2xl border border-line bg-surface p-6 sm:p-8"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" name="name" placeholder="Jordan Miller" autoComplete="name" />
        <Field label="Work email" name="email" type="email" placeholder="you@company.com" autoComplete="email" />
      </div>

      <Field label="Company" name="company" placeholder="Acme Inc." required={false} autoComplete="organization" />

      <label className="block">
        <span className="text-xs font-semibold text-ink">Topic</span>
        <select
          name="topic"
          className="mt-1.5 w-full rounded-xl border border-line bg-bg px-4 py-2.5 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
        >
          {topics.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-ink">Message</span>
        <textarea
          name="message"
          required
          rows={6}
          placeholder="What are you building, and roughly how many calls a month do you expect?"
          className="mt-1.5 w-full resize-y rounded-xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
        />
      </label>

      <button
        type="submit"
        className="rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
      >
        Send message
      </button>
    </form>
  );
}

function Field({
  label,
  required = true,
  ...props
}: { label: string; required?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-ink">
        {label}
        {!required && <span className="ml-1 font-normal text-muted">(optional)</span>}
      </span>
      <input
        {...props}
        required={required}
        className="mt-1.5 w-full rounded-xl border border-line bg-bg px-4 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
      />
    </label>
  );
}
