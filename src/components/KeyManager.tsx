"use client";

import { useActionState, useState } from "react";
import { createKey, revokeKey, type KeyState } from "@/server/actions/keys";
import type { ApiKey } from "@/lib/types";

export default function KeyManager({ keys }: { keys: ApiKey[] }) {
  const [state, formAction] = useActionState<KeyState, FormData>(createKey, null);
  const active = keys.filter((k) => !k.revokedAt);

  return (
    <div className="rounded-2xl border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-ink">API keys</h2>
          <p className="mt-0.5 text-xs text-muted">One key authenticates every API you subscribe to.</p>
        </div>
        <form action={formAction} className="flex items-center gap-2">
          <input
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

      {state?.error && (
        <p className="border-b border-line px-5 py-3 text-sm text-rose-600">{state.error}</p>
      )}

      {state?.created && (
        <div className="border-b border-line bg-accent/5 px-5 py-4">
          <p className="text-sm font-semibold text-ink">
            Copy this key now — it is not shown again.
          </p>
          <code className="mt-2 block break-all rounded-lg bg-bg px-3 py-2 font-mono text-xs text-ink">
            {state.created}
          </code>
        </div>
      )}

      {active.length === 0 ? (
        <p className="px-5 py-8 text-sm text-muted">No active keys. Create one above.</p>
      ) : (
        active.map((k) => <Row key={k.id} apiKey={k} />)
      )}
    </div>
  );
}

function Row({ apiKey }: { apiKey: ApiKey }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(apiKey.keyPrefix);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="flex flex-col gap-3 border-b border-line px-5 py-4 last:border-0 sm:flex-row sm:items-center">
      <div className="min-w-0 sm:w-44">
        <p className="text-sm font-semibold text-ink">{apiKey.label}</p>
        <p className="mt-0.5 text-xs text-muted">
          {apiKey.scope} &middot;{" "}
          {apiKey.lastUsedAt
            ? `used ${new Date(apiKey.lastUsedAt).toLocaleDateString()}`
            : "never used"}
        </p>
      </div>

      <code className="min-w-0 flex-1 truncate rounded-lg bg-elevated px-3 py-2 font-mono text-xs text-ink">
        {apiKey.keyPrefix}
        {"•".repeat(22)}
      </code>

      <div className="flex shrink-0 gap-2">
        <button
          onClick={copy}
          title="Only the prefix is stored — the full key was shown once at creation."
          className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted transition hover:text-ink"
        >
          {copied ? "Copied prefix" : "Copy prefix"}
        </button>
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
