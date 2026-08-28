import { requireUser } from "@/lib/auth";
import { getApiKeys } from "@/server/account";
import KeyManager from "@/components/KeyManager";
import { GATEWAY_BASE } from "@/lib/app-url";

export const dynamic = "force-dynamic";
export const metadata = { title: "API keys" };

export default async function KeysPage() {
  const user = await requireUser();
  const keys = await getApiKeys(user.id);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">API keys</h1>
        <p className="mt-1 text-sm text-muted">
          One key authenticates every API you subscribe to. Keys are stored as digests — the full value
          is shown once, at creation.
        </p>
      </header>

      <KeyManager keys={keys} />

      <section className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold tracking-tight text-ink">Using a key</h2>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-elevated p-4 text-[12.5px] leading-6">
          <code className="font-mono text-ink">{`curl -H "X-Zephiel-Key: zk_live_..." \
  ${GATEWAY_BASE}/multistore/stores`}</code>
        </pre>
        <p className="mt-3 text-xs leading-6 text-muted">
          Never ship a key in client-side code — proxy through your own backend. A key that appears in a
          browser bundle should be revoked immediately.
        </p>
      </section>
    </div>
  );
}
