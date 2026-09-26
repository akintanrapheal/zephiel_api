import { Card } from "@/components/admin/PageHeader";
import EmailSettingsForm from "@/components/admin/EmailSettingsForm";
import SampleEmailForm from "@/components/admin/SampleEmailForm";
import BrandingForm from "@/components/admin/BrandingForm";
import EmailTemplatesForm from "@/components/admin/EmailTemplatesForm";
import ManualInvoiceForm from "@/components/admin/ManualInvoiceForm";
import LifecycleEmailForm from "@/components/admin/LifecycleEmailForm";
import { getEmailConfig } from "@/lib/email";
import { getBranding } from "@/lib/branding";
import { getSettings } from "@/lib/settings";
import { getTemplates, TEMPLATE_LABELS, TEMPLATE_PLACEHOLDERS } from "@/lib/email-templates";
import { REMINDER_DAYS } from "@/server/notifications";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Email · Settings" };

export default async function EmailSettingsPage() {
  const [admin, email, brand, templates, settings] = await Promise.all([
    requireAdmin(),
    getEmailConfig(),
    getBranding(),
    getTemplates(),
    getSettings().catch(() => ({}) as Record<string, string>),
  ]);

  return (
    <div className="space-y-4">
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

      <Card title="Branding" padded>
        <BrandingForm
          logoUrl={brand.logoUrl}
          color={brand.color}
          footer={brand.footer}
          invoiceCurrency={(settings.invoice_currency ?? "USD").toUpperCase()}
          privacyUrl={settings.privacy_url ?? ""}
          socialX={settings.social_x ?? ""}
          socialLinkedin={settings.social_linkedin ?? ""}
          socialInstagram={settings.social_instagram ?? ""}
          socialYoutube={settings.social_youtube ?? ""}
        />
      </Card>

      <Card title="Message wording" padded>
        <EmailTemplatesForm
          labels={TEMPLATE_LABELS}
          placeholders={TEMPLATE_PLACEHOLDERS}
          templates={templates}
        />
      </Card>

      <Card title="Preview & test documents" padded>
        <SampleEmailForm adminEmail={admin.email} />
      </Card>

      <Card title="Issue an invoice" padded>
        <ManualInvoiceForm />
      </Card>

      <Card title="Send a customer email" padded>
        <LifecycleEmailForm />
      </Card>
    </div>
  );
}
