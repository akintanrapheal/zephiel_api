"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export default function CopyField({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className={cn("flex gap-2", className)}>
      <code className="min-w-0 flex-1 truncate rounded-xl bg-elevated px-3 py-2 font-mono text-xs text-ink">
        {value}
      </code>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded-xl border border-line px-3 py-2 text-xs font-medium text-muted transition hover:text-ink"
      >
        {copied ? "Copied" : "Copy"}
        <span className="sr-only"> webhook URL</span>
      </button>
    </div>
  );
}
