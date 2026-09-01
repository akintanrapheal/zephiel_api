import { getPaystackConfig } from "@/lib/paystack";
import { getSecretStatus, getSettings, usingDerivedKey } from "@/lib/settings";
import { appUrl } from "@/lib/app-url";
import { Card } from "@/components/admin/PageHeader";
import PaystackSettingsForm from "@/components/admin/PaystackSettingsForm";
import CompanyForm from "@/components/admin/CompanyForm";
import CopyField from "@/components/admin/CopyField";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payments · Settings" };

export default async function PaymentsSettingsPage() {
  const [config, secret, settings] = await Promise.all([
    getPaystackConfig(),
    getSecretStatus("paystack_secret_key"),
    getSettings(),
  ]);

  return (
    <div className="space-y-4">
      <Card title="Paystack" padded>
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <span
            className={
              config.secretKey
                ? "inline-flex items-center gap-2 rounded-lg bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent"
                : "inline-flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-600"
            }
          >
            <span className={config.secretKey ? "h-1.5 w-1.5 rounded-full bg-accent" : "h-1.5 w-1.5 rounded-full bg-amber-500"} />
            {config.secretKey ? "Connected" : "Not configured"}
          </span>

          {/* Which Paystack environment charges run against. Without this the
              only way to find out was to reach the checkout page and read the
              banner Paystack puts on it. */}
          {config.mode && (
            <span
              className={
                config.mode === "live"
                  ? "inline-flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-emerald-600"
                  : "inline-flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-amber-600"
              }
            >
              {config.mode === "live" ? "Live mode" : "Test mode"}
            </span>
          )}

          {config.secretKey && (
            <span className="text-xs text-muted">
              Key from{" "}
              <span className="font-medium text-ink">
                {config.source === "settings" ? "this console" : "environment variable"}
              </span>
              {secret.configured && !secret.unreadable && (
                <>
                  {" · "}
                  <code className="rounded bg-elevated px-1.5 py-0.5 font-mono">{secret.hint}</code>
                </>
              )}
            </span>
          )}
        </div>

        {config.storedUnreadable && (
          <p className="mb-5 rounded-xl border border-rose-500/40 bg-rose-500/5 px-4 py-3 text-sm text-ink">
            <span className="font-semibold">Payments are stopped.</span> A key is stored here but can no
            longer be decrypted, because the encryption key changed since it was saved. It is not
            silently replaced by <code className="font-mono text-xs">PAYSTACK_SECRET_KEY</code> — doing
            that would charge against a different Paystack environment than the one you configured.
            Paste the key again below to fix it.
          </p>
        )}

        {config.mode === "test" && (
          <p className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-muted">
            Checkout is running against Paystack&apos;s test environment. Cards are simulated and no
            money moves. Save an <code className="font-mono text-xs">sk_live_…</code> key to take real
            payments.
          </p>
        )}

        {secret.configured && secret.unreadable && !config.storedUnreadable && (
          <p className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-muted">
            A key is stored but can no longer be decrypted — the encryption key changed. Enter the key
            again to replace it.
          </p>
        )}

        <PaystackSettingsForm
          currency={config.currency}
          usdToNgn={config.usdToNgn}
          hasStoredKey={config.source === "settings"}
        />

        <div className="mt-6 space-y-4 border-t border-line pt-5">
          <div>
            <p className="text-xs font-semibold text-ink">Webhook URL</p>
            <p className="mt-1 text-xs text-muted">
              Paste this into Paystack → Settings → API Keys &amp; Webhooks so subscriptions activate
              even if the customer closes the tab.
            </p>
            <CopyField value={`${appUrl()}/api/paystack/webhook`} className="mt-2" />
          </div>

          <p className="text-xs leading-6 text-muted">
            {usingDerivedKey() ? (
              <>
                <span className="font-semibold text-ink">Encryption:</span> stored keys are encrypted
                with a value derived from <code className="font-mono">DATABASE_URL</code>. Set a{" "}
                <code className="font-mono">SETTINGS_KEY</code> environment variable to decouple them —
                otherwise rotating the database password makes the stored key unreadable.
              </>
            ) : (
              <>
                <span className="font-semibold text-ink">Encryption:</span> stored keys are encrypted
                with <code className="font-mono">SETTINGS_KEY</code> (AES-256-GCM).
              </>
            )}
          </p>
        </div>
      </Card>

      <Card title="Invoice details" padded>
        <CompanyForm
          name={settings.company_name ?? ""}
          address={settings.company_address ?? ""}
          taxId={settings.company_tax_id ?? ""}
        />
      </Card>
    </div>
  );
}
