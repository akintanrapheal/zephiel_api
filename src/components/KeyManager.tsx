"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createKey, revokeKey, rotateKey, type KeyState } from "@/server/actions/keys";
import type { ApiKey } from "@/lib/types";

export default function KeyManager({ keys }: { keys: ApiKey[] }) {
  const [createState, createAction] = useActionState<KeyState, FormData>(createKey, null);
  const [rotateState, rotateAction] = useActionState<KeyState, FormData>(rotateKey, null);

  const active = keys.filter((k) => !k.revokedAt);
  const minted = createState?.created ? createState : rotateState?.created ? rotateState : null;
  const error = createState?.error ?? rotateState?.error;

  return (
    <div className="rounded-2xl border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-ink">API keys</h2>
          <p className="mt-0.5 text-xs text-muted">One key authenticates every API you subscribe to.</p>
        </div>
        <form action={createAction} className="flex items-center gap-2">
          <label htmlFor="key-label" className="sr-only">
            Label for the new key
          </label>
          <input
            id="key-label"
            name="label"
            required
            maxLength={60}
            placeholder="Label, e.g. Production"
            className="rounded-lg border border-line bg-bg px-3 py-1.5 text-xs text-ink outline-none focus:border-brand-400"
          />
          <button className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-elevated">
            Create key
          </button>
        </form>
      </div>

      {error && <p className="border-b border-line px-5 py-3 text-sm text-rose-600">{error}</p>}

      {minted?.created && (
        <div className="border-b border-line bg-accent/5 px-5 py-4">
          <p className="text-sm font-semibold text-ink">
            {minted.label ? `New key for ${minted.label}` : "New key"} — copy it now, it is not shown
            again
          </p>
          <KeyReveal value={minted.created} />
        </div>
      )}

      {active.length === 0 ? (
        <p className="px-5 py-8 text-sm text-muted">No active keys. Create one above.</p>
      ) : (
        active.map((k) => <Row key={k.id} apiKey={k} rotateAction={rotateAction} />)
      )}
    </div>
  );
}

function Row({
  apiKey,
  rotateAction,
}: {
  apiKey: ApiKey;
  rotateAction: (formData: FormData) => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-line px-5 py-4 last:border-0 sm:flex-row sm:items-center">
      <div className="min-w-0 sm:w-52">
        <p className="text-sm font-semibold text-ink">{apiKey.label}</p>
        <p className="mt-0.5 text-xs text-muted">
          {apiKey.storeName ? (
            <>
              <Link href="/dashboard/stores" className="text-brand-600 hover:underline">
                {apiKey.storeName}
              </Link>{" "}
              &middot;{" "}
            </>
          ) : (
            <>{apiKey.scope} &middot; </>
          )}
          {apiKey.lastUsedAt
            ? `used ${new Date(apiKey.lastUsedAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}`
            : "never used"}
        </p>
      </div>

      {/* Only the digest is stored, so the full value can never be shown again —
          the prefix alone is displayed for identification, not for copying. */}
      <code
        className="min-w-0 flex-1 truncate rounded-lg bg-elevated px-3 py-2 font-mono text-xs text-muted"
        title="Only the first characters are stored in readable form"
      >
        {apiKey.keyPrefix}
        {"•".repeat(22)}
      </code>

      <div className="flex shrink-0 gap-2">
        <form action={rotateAction}>
          <input type="hidden" name="id" value={apiKey.id} />
          <button
            title="Issue a replacement and show it once"
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted transition hover:text-ink"
          >
            Rotate
          </button>
        </form>
        <form action={revokeKey}>
          <input type="hidden" name="id" value={apiKey.id} />
          <button className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-500/5">
            Revoke
          </button>
        </form>
      </div>
    </div>
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
