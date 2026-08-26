"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/server/actions/admin";
import { cn } from "@/lib/utils";

export function Field({
  label,
  hint,
  className,
  ...props
}: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={cn("block", className)}>
      <span className="text-xs font-semibold text-ink">{label}</span>
      {hint && <span className="ml-2 text-xs font-normal text-muted">{hint}</span>}
      <input
        {...props}
        className="mt-1.5 w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
      />
    </label>
  );
}

export function TextArea({
  label,
  hint,
  className,
  ...props
}: { label: string; hint?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className={cn("block", className)}>
      <span className="text-xs font-semibold text-ink">{label}</span>
      {hint && <span className="ml-2 text-xs font-normal text-muted">{hint}</span>}
      <textarea
        {...props}
        className="mt-1.5 w-full resize-y rounded-xl border border-line bg-bg px-3.5 py-2.5 font-mono text-[13px] leading-6 text-ink outline-none transition placeholder:text-muted focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
      />
    </label>
  );
}

export function Select({
  label,
  className,
  children,
  ...props
}: { label: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className={cn("block", className)}>
      <span className="text-xs font-semibold text-ink">{label}</span>
      <select
        {...props}
        className="mt-1.5 w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-brand-400"
      >
        {children}
      </select>
    </label>
  );
}

export function Check({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-bg px-3.5 py-2.5">
      <input type="checkbox" {...props} className="h-4 w-4 accent-brand-600" />
      <span className="text-sm font-medium text-ink">{label}</span>
    </label>
  );
}

export function Submit({ children = "Save" }: { children?: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "Saving..." : children}
    </button>
  );
}

export function Message({ state }: { state: FormState }) {
  if (!state) return null;
  if (state.error) {
    return (
      <p className="rounded-xl border border-rose-500/30 bg-rose-500/5 px-4 py-2.5 text-sm text-rose-600">
        {state.error}
      </p>
    );
  }
  if (state.ok) {
    return (
      <p className="rounded-xl border border-accent/30 bg-accent/5 px-4 py-2.5 text-sm text-accent">
        {state.ok}
      </p>
    );
  }
  return null;
}

/** Wraps a server action with useActionState and renders its result message. */
export function ActionForm({
  action,
  children,
  className,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      {children}
      <Message state={state} />
    </form>
  );
}
