import { Card } from "@/components/admin/PageHeader";
import EmailSettingsForm from "@/components/admin/EmailSettingsForm";
import SampleEmailForm from "@/components/admin/SampleEmailForm";
import { getEmailConfig } from "@/lib/email";
import { REMINDER_DAYS } from "@/server/notifications";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Email · Settings" };

export default async function EmailSettingsPage() {
  const [admin, email] = await Promise.all([requireAdmin(), getEmailConfig()]);

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

      <Card title="Preview & test documents" padded>
        <SampleEmailForm adminEmail={admin.email} />
      </Card>
    </div>
  );
}
