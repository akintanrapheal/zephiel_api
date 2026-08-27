import { getPaystackConfig } from "@/lib/paystack";
import { getSecretStatus, getSettings, usingDerivedKey } from "@/lib/settings";
import { appUrl } from "@/lib/app-url";
import PageHeader, { Card } from "@/components/admin/PageHeader";
import PaystackSettingsForm from "@/components/admin/PaystackSettingsForm";
import PlatformSettingsForm from "@/components/admin/PlatformSettingsForm";
import CopyField from "@/components/admin/CopyField";
import PasswordForm from "@/components/admin/PasswordForm";
import EmailSettingsForm from "@/components/admin/EmailSettingsForm";
import { getEmailConfig } from "@/lib/email";
import { REMINDER_DAYS } from "@/server/notifications";
import { getSchemaStatus } from "@/server/schema-status";
import SchemaCard from "@/components/admin/SchemaCard";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  const [admin, config, secret, settings, email, schema] = await Promise.all([
    requireAdmin(),
    getPaystackConfig(),
    getSecretStatus("paystack_secret_key"),
    getSettings(),
    getEmailConfig(),
    getSchemaStatus(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Payment credentials and platform configuration."
      />

      <Card title="Database schema" padded>
        <SchemaCard
          missingTables={schema.missingTables}
          missingColumns={schema.missingColumns}
          upToDate={schema.upToDate}
        />
      </Card>

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

        {secret.configured && secret.unreadable && (
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

      <Card title="Email & reminders" padded>
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <span
            className={
              email.apiKey
                ? "inline-flex items-center gap-2 rounded-lg bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent"
                : "inline-flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-600"
            }
          >
            <span className={email.apiKey ? "h-1.5 w-1.5 rounded-full bg-accent" : "h-1.5 w-1.5 rounded-full bg-amber-500"} />
            {email.apiKey ? "Connected" : "Not configured"}
          </span>
          {email.apiKey && (
            <span className="text-xs text-muted">
              Key from{" "}
              <span className="font-medium text-ink">
                {email.source === "settings" ? "this console" : "environment variable"}
              </span>
            </span>
          )}
        </div>

        <EmailSettingsForm
          from={email.from}
          hasStoredKey={email.source === "settings"}
          reminderDays={REMINDER_DAYS}
        />
      </Card>

      <Card title="Your password" padded>
        <PasswordForm email={admin.email} />
      </Card>

      <Card title="Platform" padded>
        <PlatformSettingsForm
          platformName={settings.platform_name ?? "Zephiel API"}
          supportEmail={settings.support_email ?? ""}
        />
      </Card>

      <Card title="Environment" padded>
        <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          {[
            { label: "Site origin", value: appUrl() },
            { label: "Charge currency", value: config.currency },
            {
              label: "USD conversion",
              value: config.currency === "USD" ? "Not applied" : `1 USD = ${config.usdToNgn.toLocaleString()} ${config.currency}`,
            },
            { label: "Gateway base", value: `${appUrl()}/api/v1` },
          ].map((row) => (
            <div key={row.label} className="flex justify-between gap-4 border-b border-line pb-2">
              <dt className="text-muted">{row.label}</dt>
              <dd className="truncate text-right font-medium text-ink">{row.value}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
