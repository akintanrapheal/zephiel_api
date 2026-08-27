"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { runMigrations } from "@/server/actions/settings";
import type { FormState } from "@/server/actions/admin";
import { Message } from "./Form";

export default function SchemaCard({
  missingTables,
  missingColumns,
  upToDate,
}: {
  missingTables: string[];
  missingColumns: string[];
  upToDate: boolean;
}) {
  const [state, action] = useActionState<FormState>(runMigrations, null);
  const missing = [...missingTables, ...missingColumns];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={
            upToDate
              ? "inline-flex items-center gap-2 rounded-lg bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent"
              : "inline-flex items-center gap-2 rounded-lg bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-600"
          }
        >
          <span className={upToDate ? "h-1.5 w-1.5 rounded-full bg-accent" : "h-1.5 w-1.5 rounded-full bg-rose-500"} />
          {upToDate ? "Up to date" : `${missing.length} missing`}
        </span>

        {!upToDate && (
          <span className="text-xs text-muted">
            Pages using these will return a server error until the schema is applied.
          </span>
        )}
      </div>

      {missing.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {missing.map((m) => (
            <li
              key={m}
              className="rounded-md bg-rose-500/10 px-2 py-1 font-mono text-[11px] font-medium text-rose-600"
            >
              {m}
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs leading-6 text-muted">
        Applies <code className="rounded bg-elevated px-1.5 py-0.5 font-mono">db/schema.sql</code>, which
        contains only <code className="rounded bg-elevated px-1.5 py-0.5 font-mono">IF NOT EXISTS</code>{" "}
        statements. It creates what is missing and never drops or alters existing data, so it is safe to
        run at any time — including when nothing has changed.
      </p>

      <form action={action} className="flex flex-wrap items-center gap-3">
        <RunButton upToDate={upToDate} />
        <Message state={state} />
      </form>
    </div>
  );
}

function RunButton({ upToDate }: { upToDate: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        upToDate
          ? "rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-elevated disabled:opacity-60"
          : "rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
      }
    >
      {pending ? "Applying…" : upToDate ? "Re-run migrations" : "Run migrations"}
    </button>
  );
}
