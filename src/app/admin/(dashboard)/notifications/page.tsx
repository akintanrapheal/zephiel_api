import Link from "next/link";
import { listNotifications, findExpiring, REMINDER_DAYS } from "@/server/notifications";
import { isEmailConfigured } from "@/lib/email";
import PageHeader, { Card } from "@/components/admin/PageHeader";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notifications" };

const statusStyles: Record<string, string> = {
  sent: "bg-accent/10 text-accent",
  sending: "bg-amber-500/10 text-amber-600",
  failed: "bg-rose-500/10 text-rose-600",
};

export default async function NotificationsPage() {
  const [sent, due, configured] = await Promise.all([
    listNotifications(),
    findExpiring(),
    isEmailConfigured(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description={`Renewal reminders go out ${REMINDER_DAYS.join(", ")} days before a subscription expires.`}
        action={
          <Link
            href="/admin/settings"
            className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-elevated"
          >
            Email settings
          </Link>
        }
      />

      {!configured && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-muted">
          <span className="font-semibold text-ink">No email provider configured.</span> Reminders are
          queued by the daily sweep but cannot be delivered until a key is set in{" "}
          <Link href="/admin/settings" className="font-semibold text-brand-600 underline">
            Settings
          </Link>
          .
        </div>
      )}

      <Card title="Due for a reminder today" padded>
        {due.length === 0 ? (
          <p className="text-sm text-muted">
            No subscriptions fall on a reminder day today. The sweep runs at 09:00 UTC.
          </p>
        ) : (
          <ul className="space-y-2">
            {due.map((d) => (
              <li key={d.subscription_id} className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-medium text-ink">{d.email}</span>
                <span className="text-muted">{d.api_name}</span>
                <span className="ml-auto text-xs text-muted">
                  renews{" "}
                  {new Date(d.period_end).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Recently sent">
        {sent.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">Nothing sent yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <caption className="sr-only">Renewal reminder emails, most recent first</caption>
              <thead>
                <tr className="bg-elevated text-left">
                  <th scope="col" className="px-5 py-3 font-semibold text-ink">Recipient</th>
                  <th scope="col" className="px-5 py-3 font-semibold text-ink">API</th>
                  <th scope="col" className="px-5 py-3 font-semibold text-ink">Kind</th>
                  <th scope="col" className="px-5 py-3 font-semibold text-ink">Status</th>
                  <th scope="col" className="px-5 py-3 font-semibold text-ink">Sent</th>
                </tr>
              </thead>
              <tbody>
                {sent.map((n, i) => (
                  <tr key={n.id} className={i % 2 ? "bg-elevated/40" : "bg-surface"}>
                    <td className="px-5 py-3 text-ink">{n.email}</td>
                    <td className="px-5 py-3 text-muted">{n.api_name ?? "—"}</td>
                    <td className="px-5 py-3 font-mono text-xs text-muted">{n.kind}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                          statusStyles[n.status] ?? "bg-elevated text-muted"
                        }`}
                        title={n.detail || undefined}
                      >
                        {n.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted">
                      {new Date(n.created_at).toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
