"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { addMember, removeMember } from "@/server/actions/team";
import type { FormState } from "@/server/actions/admin";

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "Adding…" : children}
    </button>
  );
}

function Note({ state }: { state: FormState }) {
  if (!state) return null;
  const err = "error" in state && state.error;
  return (
    <p className={err ? "text-sm font-medium text-rose-600" : "text-sm font-medium text-accent"}>
      {err ? state.error : "ok" in state ? state.ok : null}
    </p>
  );
}

const field =
  "mt-1.5 w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10";

export function AddMemberForm() {
  const [state, action] = useActionState<FormState, FormData>(addMember, null);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="text-xs font-semibold text-ink">Name</span>
          <input name="name" required maxLength={120} autoComplete="off" className={field} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink">Email</span>
          <input name="email" type="email" required autoComplete="off" className={field} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink">Temporary password</span>
          <input name="password" type="text" required minLength={8} autoComplete="off" className={field} />
        </label>
      </div>
      <p className="text-xs text-muted">
        Give the member this password — they can change it from their own Profile after signing in.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Submit>Add member</Submit>
        <Note state={state} />
      </div>
    </form>
  );
}

export function RemoveMemberButton({ memberId, label }: { memberId: string; label: string }) {
  return (
    <form action={removeMember}>
      <input type="hidden" name="memberId" value={memberId} />
      <button
        type="submit"
        aria-label={`Remove ${label}`}
        className="text-sm font-medium text-rose-600 transition hover:underline"
      >
        Remove
      </button>
    </form>
  );
}
