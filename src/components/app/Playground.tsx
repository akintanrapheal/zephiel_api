"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type PlaygroundApi = {
  slug: string;
  name: string;
  endpoints: { method: string; path: string; summary: string }[];
};

type Result = {
  status: number;
  ms: number;
  body: string;
  rateLimit: { limit: string | null; remaining: string | null };
};

/**
 * Fires a real request at the gateway using a key the developer pastes in.
 *
 * The key is held in component state only — never persisted, never sent
 * anywhere but the gateway — because we store only its SHA-256 digest and
 * genuinely cannot recover the plaintext to prefill this.
 */
export default function Playground({ apis }: { apis: PlaygroundApi[] }) {
  const [slug, setSlug] = useState(apis[0]?.slug ?? "");
  const [path, setPath] = useState(apis[0]?.endpoints[0]?.path ?? "/");
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const api = apis.find((a) => a.slug === slug);

  // Endpoints declare path parameters as {ip}, {id} and so on. Sending those
  // literally would 404, so they are substituted with a usable sample.
  const samples: Record<string, string> = {
    ip: "8.8.8.8",
    id: "st_demo",
    slug: "example",
    hash: "5baa61e4",
    prefix: "5baa6",
    domain: "example.com",
    asset: "BTC",
    jobId: "job_demo",
  };
  const resolved = path.replace(/\{(\w+)\}/g, (_, name: string) => samples[name] ?? "demo");
  const url = `/api/v1/${slug}${resolved}`;

  const onApiChange = (next: string) => {
    setSlug(next);
    const first = apis.find((a) => a.slug === next)?.endpoints[0]?.path ?? "/";
    setPath(first);
    setResult(null);
  };

  const send = async () => {
    setBusy(true);
    setError(null);
    setResult(null);

    const started = performance.now();
    try {
      const res = await fetch(url, {
        headers: key ? { "X-Zephiel-Key": key } : {},
      });
      const text = await res.text();

      let pretty = text;
      try {
        pretty = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        /* not JSON — show as-is */
      }

      setResult({
        status: res.status,
        ms: Math.round(performance.now() - started),
        body: pretty,
        rateLimit: {
          limit: res.headers.get("x-ratelimit-limit"),
          remaining: res.headers.get("x-ratelimit-remaining"),
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  };

  if (apis.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line px-5 py-12 text-center text-sm text-muted">
        Subscribe to an API first — the playground calls the real gateway, which requires an active
        subscription.
      </p>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-2xl border border-line bg-surface p-6">
        <div className="space-y-4">
          <label className="block">
            <span className="text-xs font-semibold text-ink">API</span>
            <select
              value={slug}
              onChange={(e) => onApiChange(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand-400"
            >
              {apis.map((a) => (
                <option key={a.slug} value={a.slug}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-ink">Endpoint</span>
            <select
              value={path}
              onChange={(e) => {
                setPath(e.target.value);
                setResult(null);
              }}
              className="mt-1.5 w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 font-mono text-sm text-ink outline-none focus:border-brand-400"
            >
              {api?.endpoints.map((e) => (
                <option key={e.method + e.path} value={e.path}>
                  {e.method} {e.path} — {e.summary}
                </option>
              ))}
            </select>
          </label>

          <div>
            <label htmlFor="pg-key" className="block text-xs font-semibold text-ink">
              Your API key
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                id="pg-key"
                type={showKey ? "text" : "password"}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="zk_live_…"
                autoComplete="off"
                spellCheck={false}
                aria-describedby="pg-key-help"
                className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-3.5 py-2.5 font-mono text-sm text-ink outline-none focus:border-brand-400"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                aria-pressed={showKey}
                className="shrink-0 rounded-xl border border-line px-3 text-xs font-medium text-muted transition hover:text-ink"
              >
                {showKey ? "Hide" : "Show"}
              </button>
            </div>
            <p id="pg-key-help" className="mt-1.5 text-xs text-muted">
              Kept in this page only — we store just a digest of your key, so it cannot be prefilled.
            </p>
          </div>

          <div className="rounded-xl bg-elevated px-3.5 py-2.5">
            <code className="block break-all font-mono text-xs text-ink">
              <span className="font-bold text-accent">GET</span> {url}
            </code>
            {resolved !== path && (
              <p className="mt-1.5 text-[11px] text-muted">
                Path parameters filled with sample values.
              </p>
            )}
          </div>

          <button
            onClick={send}
            disabled={busy}
            className="w-full rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? "Sending…" : "Send request"}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-[#0c1220]">
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <span className="text-xs font-semibold text-slate-400">Response</span>
          {result && (
            <>
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 font-mono text-[10px] font-bold",
                  result.status < 400 ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
                )}
              >
                {result.status}
              </span>
              <span className="font-mono text-[10px] text-slate-500">{result.ms}ms</span>
              {result.rateLimit.remaining && (
                <span className="ml-auto font-mono text-[10px] text-slate-500">
                  {result.rateLimit.remaining}/{result.rateLimit.limit} left
                </span>
              )}
            </>
          )}
        </div>

        <div className="max-h-[420px] overflow-auto p-5" aria-live="polite">
          {error && <p className="font-mono text-xs text-rose-400">{error}</p>}

          {!error && !result && (
            <p className="font-mono text-xs text-slate-500">
              Pick an endpoint, paste your key, and send a request. This calls the real gateway — it
              counts against your quota.
            </p>
          )}

          {result && (
            <pre className="text-[12.5px] leading-6 text-slate-200">
              <code className="font-mono">{result.body}</code>
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
