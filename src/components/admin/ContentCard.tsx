"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { reseedCatalogue } from "@/server/actions/settings";
import type { FormState } from "@/server/actions/admin";
import { Message } from "./Form";

export default function ContentCard({
  apis,
  reviews,
  posts,
}: {
  apis: number;
  reviews: number;
  posts: number;
}) {
  const [state, action] = useActionState<FormState>(reseedCatalogue, null);

  return (
    <div className="space-y-4">
      <dl className="grid gap-3 sm:grid-cols-3">
        {[
          ["APIs", apis],
          ["Reviews", reviews],
          ["Posts", posts],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-line bg-bg px-4 py-3">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="mt-0.5 text-xl font-semibold tabular-nums text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      <p className="text-xs leading-6 text-muted">
        Loads the catalogue shipped with this build — APIs, categories, plans, endpoints, seeded
        reviews, and blog posts. Content is matched by slug, so running it again refreshes rather
        than duplicates. Plans, endpoints, and seeded reviews are replaced;{" "}
        <span className="font-medium text-ink">
          accounts, subscriptions, payments, keys, usage, and customer-written reviews are left
          alone
        </span>
        . Anything you edited in the console that also exists in the data files will be overwritten.
      </p>

      <form action={action} className="flex flex-wrap items-center gap-3">
        <SeedButton />
        <Message state={state} />
      </form>
    </div>
  );
}

function SeedButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-elevated disabled:opacity-60"
    >
      {pending ? "Loading…" : "Reseed catalogue"}
    </button>
  );
}
