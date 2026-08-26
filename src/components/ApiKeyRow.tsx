"use client";

import { useState } from "react";

export default function ApiKeyRow({
  label,
  scope,
  created,
  secret,
}: {
  label: string;
  scope: string;
  created: string;
  secret: string;
}) {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);

  const masked = `${secret.slice(0, 11)}${"•".repeat(18)}${secret.slice(-4)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="flex flex-col gap-3 border-b border-line px-5 py-4 last:border-0 sm:flex-row sm:items-center">
      <div className="min-w-0 sm:w-44">
        <p className="text-sm font-semibold text-ink">{label}</p>
        <p className="mt-0.5 text-xs text-muted">
          {scope} &middot; {created}
        </p>
      </div>

      <code className="min-w-0 flex-1 truncate rounded-lg bg-elevated px-3 py-2 font-mono text-xs text-ink">
        {shown ? secret : masked}
      </code>

      <div className="flex shrink-0 gap-2">
        <button
          onClick={() => setShown((v) => !v)}
          className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted transition hover:text-ink"
        >
          {shown ? "Hide" : "Reveal"}
        </button>
        <button
          onClick={copy}
          className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted transition hover:text-ink"
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <button className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-500/5">
          Revoke
        </button>
      </div>
    </div>
  );
}
