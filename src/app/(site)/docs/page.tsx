import type { Metadata } from "next";
import Link from "next/link";
import CodeSamples from "@/components/CodeSamples";
import { getApis } from "@/server/catalog";

export const metadata: Metadata = {
  title: "Documentation",
  description: "Authentication, quickstart, errors, rate limits, webhooks, and SDKs for the Zephiel API platform.",
};

const nav = [
  { id: "quickstart", label: "Quickstart" },
  { id: "authentication", label: "Authentication" },
  { id: "requests", label: "Requests & responses" },
  { id: "errors", label: "Error reference" },
  { id: "rate-limits", label: "Rate limits" },
  { id: "webhooks", label: "Webhooks" },
  { id: "sdks", label: "SDKs" },
];

const errors = [
  { code: "400", name: "invalid_request", desc: "A required parameter is missing or malformed. The message names the field." },
  { code: "401", name: "missing_key", desc: "No X-Zephiel-Key header was sent." },
  { code: "403", name: "not_subscribed", desc: "Your key is valid but has no active plan for this API." },
  { code: "404", name: "not_found", desc: "The endpoint or the requested resource does not exist." },
  { code: "422", name: "unprocessable", desc: "The request was well-formed but the upstream data could not satisfy it." },
  { code: "429", name: "rate_limited", desc: "Plan rate limit exceeded. Retry after the seconds given in Retry-After." },
  { code: "500", name: "internal_error", desc: "Something failed on our side. These are never billed." },
  { code: "503", name: "upstream_unavailable", desc: "A provider dependency is degraded. Check /status." },
];

export const revalidate = 60;

export default async function DocsPage() {
  const apis = await getApis();
  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-12">
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">On this page</p>
            <nav className="mt-4 space-y-1">
              {nav.map((n) => (
                <a
                  key={n.id}
                  href={`#${n.id}`}
                  className="block rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-elevated hover:text-ink"
                >
                  {n.label}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        <div className="min-w-0">
          <header>
            <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Documentation</h1>
            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-muted">
              Every API on Zephiel shares one base URL, one authentication header, one error envelope, and
              one rate-limit contract. Learn it once and every listing works the same way.
            </p>
          </header>

          <section id="quickstart" className="mt-14 scroll-mt-24">
            <h2 className="text-xl font-semibold tracking-tight text-ink">Quickstart</h2>
            <ol className="mt-4 space-y-3 text-sm leading-7 text-muted">
              <li>
                <span className="font-semibold text-ink">1.</span> Create a free account and copy your key
                from the <Link href="/dashboard" className="text-brand-600 hover:underline">dashboard</Link>.
              </li>
              <li>
                <span className="font-semibold text-ink">2.</span> Store it as{" "}
                <code className="rounded bg-elevated px-1.5 py-0.5 font-mono text-xs text-ink">ZEPHIEL_API_KEY</code> in your environment.
              </li>
              <li>
                <span className="font-semibold text-ink">3.</span> Call any endpoint. The example below returns live FX rates.
              </li>
            </ol>
            <div className="mt-6">
              <CodeSamples slug="exchange-rates-data" endpoint="/latest?base=USD&symbols=EUR,GBP" />
            </div>
          </section>

          <section id="authentication" className="mt-14 scroll-mt-24">
            <h2 className="text-xl font-semibold tracking-tight text-ink">Authentication</h2>
            <p className="mt-3 text-sm leading-7 text-muted">
              Pass your key in the <code className="rounded bg-elevated px-1.5 py-0.5 font-mono text-xs text-ink">X-Zephiel-Key</code> header
              on every request. Query-string keys are accepted for browser prototyping but are logged by
              intermediaries, so never use them in production. Keys are scoped per project and can be
              rotated without downtime by creating a second key before revoking the first.
            </p>
            <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
              <p className="text-sm font-semibold text-ink">Never expose a key in client-side code</p>
              <p className="mt-1.5 text-sm leading-6 text-muted">
                Proxy requests through your own backend. Any key that appears in a browser bundle should be
                treated as compromised and rotated immediately.
              </p>
            </div>
          </section>

          <section id="requests" className="mt-14 scroll-mt-24">
            <h2 className="text-xl font-semibold tracking-tight text-ink">Requests &amp; responses</h2>
            <p className="mt-3 text-sm leading-7 text-muted">
              The base URL is <code className="rounded bg-elevated px-1.5 py-0.5 font-mono text-xs text-ink">https://zephiel.com/api/v1/&#123;api-slug&#125;</code>.
              Responses are JSON, UTF-8, and always include a top-level{" "}
              <code className="rounded bg-elevated px-1.5 py-0.5 font-mono text-xs text-ink">success</code> boolean.
            </p>
            <pre className="mt-5 overflow-x-auto rounded-2xl border border-line bg-elevated p-5 text-[13px] leading-6">
              <code className="font-mono text-ink">{`{
  "success": false,
  "error": {
    "code": "rate_limited",
    "message": "Plan rate limit of 60 req/min exceeded.",
    "retry_after": 23,
    "docs": "https://zephiel.com/docs#rate-limits"
  }
}`}</code>
            </pre>
          </section>

          <section id="errors" className="mt-14 scroll-mt-24">
            <h2 className="text-xl font-semibold tracking-tight text-ink">Error reference</h2>
            <div className="mt-5 overflow-x-auto rounded-2xl border border-line">
              <table className="w-full min-w-[560px] border-collapse text-sm">
              <caption className="sr-only">HTTP error codes returned by the API</caption>
                <thead>
                  <tr className="bg-elevated">
                    <th scope="col" className="px-5 py-3 text-left font-semibold text-ink">Status</th>
                    <th scope="col" className="px-5 py-3 text-left font-semibold text-ink">Code</th>
                    <th scope="col" className="px-5 py-3 text-left font-semibold text-ink">Meaning</th>
                  </tr>
                </thead>
                <tbody>
                  {errors.map((e, i) => (
                    <tr key={e.code} className={i % 2 ? "bg-elevated/40" : "bg-surface"}>
                      <td className="px-5 py-3 font-mono text-xs text-ink">{e.code}</td>
                      <td className="px-5 py-3 font-mono text-xs text-brand-600">{e.name}</td>
                      <td className="px-5 py-3 text-muted">{e.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="rate-limits" className="mt-14 scroll-mt-24">
            <h2 className="text-xl font-semibold tracking-tight text-ink">Rate limits</h2>
            <p className="mt-3 text-sm leading-7 text-muted">
              Limits are enforced per key, per minute, using a sliding window. Every response carries the
              current state so you can back off before hitting a 429.
            </p>
            <pre className="mt-5 overflow-x-auto rounded-2xl border border-line bg-elevated p-5 text-[13px] leading-6">
              <code className="font-mono text-ink">{`X-RateLimit-Limit: 600
X-RateLimit-Remaining: 583
X-RateLimit-Reset: 1756213860
Retry-After: 23`}</code>
            </pre>
          </section>

          <section id="webhooks" className="mt-14 scroll-mt-24">
            <h2 className="text-xl font-semibold tracking-tight text-ink">Webhooks</h2>
            <p className="mt-3 text-sm leading-7 text-muted">
              Long-running operations — bulk email verification, transcription, crawls — post back to your
              endpoint when they finish. Every delivery is signed with HMAC-SHA256 in the{" "}
              <code className="rounded bg-elevated px-1.5 py-0.5 font-mono text-xs text-ink">X-Zephiel-Signature</code> header.
              Compare it against your signing secret before trusting the body, and respond 2xx within 10
              seconds or we retry with exponential backoff for 24 hours.
            </p>
          </section>

          <section id="sdks" className="mt-14 scroll-mt-24">
            <h2 className="text-xl font-semibold tracking-tight text-ink">SDKs</h2>
            <p className="mt-3 text-sm leading-7 text-muted">
              Official clients wrap authentication, retries, and typed responses for all {apis.length} APIs.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { name: "TypeScript", cmd: "npm i @zephiel/sdk" },
                { name: "Python", cmd: "pip install zephiel" },
                { name: "PHP", cmd: "composer require zephiel/sdk" },
                { name: "Go", cmd: "go get zephiel.com/sdk" },
              ].map((s) => (
                <div key={s.name} className="rounded-xl border border-line bg-surface p-4">
                  <p className="text-sm font-semibold text-ink">{s.name}</p>
                  <code className="mt-2 block break-all font-mono text-xs text-muted">{s.cmd}</code>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-16 rounded-2xl border border-line bg-surface p-6">
            <h2 className="text-base font-semibold tracking-tight text-ink">Per-API reference</h2>
            <p className="mt-2 text-sm text-muted">
              Endpoint-level docs live on each listing. Jump straight to one:
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {apis.slice(0, 10).map((a) => (
                <Link
                  key={a.slug}
                  href={`/marketplace/${a.slug}`}
                  className="rounded-full border border-line px-3 py-1.5 text-xs text-muted transition hover:border-brand-300 hover:text-ink"
                >
                  {a.name}
                </Link>
              ))}
              <Link href="/marketplace" className="rounded-full bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white">
                All APIs
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
