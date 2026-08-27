"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { addStore, removeStore, rotateStoreKey, setStoreStatus, type StoreState } from "@/server/actions/stores";
import { PLATFORMS } from "@/lib/platforms";
import type { Store } from "@/server/account";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  synced: "bg-accent/10 text-accent",
  syncing: "bg-brand-500/10 text-brand-600",
  sandbox: "bg-elevated text-muted",
  error: "bg-rose-500/10 text-rose-600",
};

export default function StoreManager({
  stores,
  canAdd,
  pricePerStore,
}: {
  stores: Store[];
  canAdd: boolean;
  pricePerStore: number;
}) {
  const [addState, addAction] = useActionState<StoreState, FormData>(addStore, null);
  const [rotateState, rotateAction] = useActionState<StoreState, FormData>(rotateStoreKey, null);

  // Whichever action last minted a key — shown once, then gone.
  const minted = addState?.createdKey ? addState : rotateState?.createdKey ? rotateState : null;

  return (
    <div className="space-y-6">
      {minted?.createdKey && (
        <div className="rounded-2xl border border-accent/30 bg-accent/5 p-5">
          <p className="text-sm font-semibold text-ink">
            Key for {minted.storeName} — copy it now, it is not shown again
          </p>
          <KeyReveal value={minted.createdKey} />
        </div>
      )}

      <section className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold tracking-tight text-ink">Connect a store</h2>
        <p className="mt-1 text-xs text-muted">
          Each store gets its own key, so you can attribute traffic and revoke one without touching the
          others. Billing is ${pricePerStore} per connected store, per month.
        </p>

        <form action={addAction} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <label className="flex-1">
            <span className="sr-only">Store name</span>
            <input
              name="name"
              required
              maxLength={60}
              placeholder="Lagos Flagship"
              className="w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
            />
          </label>

          <label className="sm:w-48">
            <span className="sr-only">Platform</span>
            <select
              name="platform"
              defaultValue="shopify"
              className="w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand-400"
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p[0].toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
          </label>

          <AddButton disabled={!canAdd} />
        </form>

        {!canAdd && (
          <p className="mt-3 rounded-xl bg-amber-500/10 px-4 py-2.5 text-xs text-amber-600">
            An active Multistore subscription is required before connecting a store.
          </p>
        )}

        {addState?.error && (
          <p className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/5 px-4 py-2.5 text-sm text-rose-600">
            {addState.error}
          </p>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-tight text-ink">
            Connected stores <span className="text-muted">({stores.length})</span>
          </h2>
          {stores.length > 0 && (
            <p className="text-xs text-muted">
              Billing{" "}
              <span className="font-semibold text-ink">
                ${(stores.length * pricePerStore).toLocaleString()}/mo
              </span>
            </p>
          )}
        </div>

        {stores.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-5 py-12 text-center text-sm text-muted">
            No stores yet. Connect your first one above.
          </p>
        ) : (
          <ul className="space-y-3">
            {stores.map((s) => (
              <li
                key={s.id}
                className="rounded-2xl border border-line bg-surface p-5 transition hover:border-brand-300 hover:shadow-card"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    aria-hidden
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-500/10 text-brand-600"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4">
                      <path
                        d="M4 9h16v11H4zM3 9l2-5h14l2 5a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0zM10 20v-5h4v5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{s.name}</p>
                    <p className="truncate text-xs capitalize text-muted">
                      {s.platform} &middot; {s.calls.toLocaleString()} calls
                      {s.lastCall && ` · last ${new Date(s.lastCall).toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}`}
                    </p>
                  </div>

                  <form action={setStoreStatus} className="shrink-0">
                    <input type="hidden" name="id" value={s.id} />
                    <select
                      name="status"
                      defaultValue={s.status}
                      onChange={(e) => e.currentTarget.form?.requestSubmit()}
                      aria-label={`Status for ${s.name}`}
                      className={cn(
                        "rounded-md border-0 px-2 py-1 text-[10px] font-bold uppercase",
                        statusStyles[s.status] ?? "bg-elevated text-muted"
                      )}
                    >
                      {["synced", "syncing", "sandbox", "error"].map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </form>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <code className="min-w-0 flex-1 truncate rounded-lg bg-elevated px-3 py-1.5 font-mono text-xs text-muted">
                    {s.keyPrefix ? `${s.keyPrefix}${"•".repeat(20)}` : "no active key"}
                  </code>

                  <form action={rotateAction}>
                    <input type="hidden" name="id" value={s.id} />
                    <button className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted transition hover:text-ink">
                      Rotate key
                    </button>
                  </form>

                  <form action={removeStore}>
                    <input type="hidden" name="id" value={s.id} />
                    <button className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-500/5">
                      Disconnect
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}

        {rotateState?.error && (
          <p className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/5 px-4 py-2.5 text-sm text-rose-600">
            {rotateState.error}
          </p>
        )}
      </section>
    </div>
  );
}

function AddButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="shrink-0 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "Connecting…" : "Connect store"}
    </button>
  );
}

function KeyReveal({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="mt-3 flex gap-2">
      <code className="min-w-0 flex-1 break-all rounded-lg bg-bg px-3 py-2 font-mono text-xs text-ink">
        {value}
      </code>
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          } catch {
            /* clipboard unavailable */
          }
        }}
        className="shrink-0 rounded-lg border border-line px-3 py-2 text-xs font-medium text-muted transition hover:text-ink"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
