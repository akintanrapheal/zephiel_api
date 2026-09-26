import "server-only";
import { sql } from "@/lib/db";
import { emailShell, sendEmail } from "@/lib/email";
import { getBranding, renderFooter } from "@/lib/branding";
import { getTemplates, fillTemplate } from "@/lib/email-templates";
import { appUrl } from "@/lib/app-url";

/** Days before expiry at which a reminder goes out. */
export const REMINDER_DAYS = [14, 7, 1] as const;

type Expiring = {
  subscription_id: string;
  user_id: string;
  email: string;
  name: string;
  api_name: string;
  api_slug: string;
  plan_name: string;
  price: string;
  unit: string | null;
  units: number;
  period_end: Date;
  days_left: number;
};

/**
 * Active subscriptions whose renewal date falls on one of the reminder days.
 *
 * Matching on whole days rather than a window means a daily sweep sends each
 * reminder exactly once; the unique index on notifications is the backstop if
 * the sweep runs twice in a day.
 */
export async function findExpiring(days: readonly number[] = REMINDER_DAYS) {
  return sql<Expiring[]>`
    SELECT
      s.id AS subscription_id, s.user_id, u.email, u.name,
      a.name AS api_name, a.slug AS api_slug,
      p.name AS plan_name, p.price, p.unit, s.units,
      s.current_period_end AS period_end,
      (s.current_period_end::date - CURRENT_DATE) AS days_left
    FROM subscriptions s
    JOIN users u ON u.id = s.user_id
    JOIN apis  a ON a.id = s.api_id
    JOIN plans p ON p.id = s.plan_id
    WHERE s.status = 'active'
      AND s.current_period_end IS NOT NULL
      AND (s.current_period_end::date - CURRENT_DATE) = ANY(${[...days]})
  `;
}

export type SweepResult = {
  considered: number;
  sent: number;
  skipped: number;
  failed: number;
  details: string[];
};

/**
 * Send a renewal reminder for every subscription due one, recording each
 * attempt. Already-sent reminders are skipped via the unique index rather than
 * a pre-check, so two concurrent sweeps cannot double-send.
 */
export async function sweepRenewalReminders(): Promise<SweepResult> {
  const due = await findExpiring();
  const result: SweepResult = { considered: due.length, sent: 0, skipped: 0, failed: 0, details: [] };

  // Branding and template copy are the same for every message in this run, so
  // fetch them once rather than per subscription.
  const [brand, templates] = await Promise.all([getBranding(), getTemplates()]);

  for (const row of due) {
    const daysLeft = Math.max(
      0,
      Math.round((new Date(row.period_end).getTime() - Date.now()) / 86_400_000)
    );
    // Free/sandbox trials get an upgrade-focused message (and their own notification kind) instead of
    // the "renews" wording — there's nothing to renew: it simply ends and their integration breaks.
    const isFree = Number(row.price) === 0;
    const bucket = daysLeft <= 1 ? 1 : daysLeft <= 7 ? 7 : 14;
    const kind = `${isFree ? "sandbox" : "renewal"}_${bucket}d`;

    // Claim the send first. A duplicate key means another run already did it.
    try {
      await sql`
        INSERT INTO notifications (user_id, subscription_id, kind, period_end, status)
        VALUES (${row.user_id}, ${row.subscription_id}, ${kind}, ${row.period_end}, 'sending')
      `;
    } catch (err) {
      if ((err as { code?: string })?.code === "23505") {
        result.skipped += 1;
        continue;
      }
      throw err;
    }

    const monthly = Number(row.price) * (row.unit ? row.units : 1);
    const renews = new Date(row.period_end).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const firstName = row.name ? ` ${row.name.split(" ")[0]}` : "";

    // Copy comes from the (editable) templates; only the CTA and detail rows are
    // decided in code, since those depend on free-vs-paid mechanics.
    const { subject, heading, intro, note } = fillTemplate(
      isFree ? templates.sandbox : templates.renewal,
      {
        firstName,
        name: row.name ?? "",
        api: row.api_name,
        plan: row.plan_name,
        days: String(daysLeft),
        date: renews,
        amount: monthly === 0 ? "Free" : `$${monthly.toLocaleString()}`,
        company: brand.companyName,
      }
    );

    const html = emailShell({
      heading,
      intro,
      rows: [
        { label: "API", value: row.api_name },
        { label: "Plan", value: row.plan_name },
        ...(isFree ? [] : [{ label: "Monthly", value: monthly === 0 ? "Free" : `$${monthly.toLocaleString()}` }]),
        ...(row.unit ? [{ label: "Billable units", value: `${row.units} ${row.unit}s` }] : []),
        { label: isFree ? "Sandbox ends" : "Renews", value: renews },
      ],
      bodyNote: note,
      ctaLabel: isFree ? "Upgrade now" : "Review subscription",
      ctaHref: isFree ? `${appUrl()}/pricing` : `${appUrl()}/dashboard`,
      brand: { logoUrl: brand.logoUrl, color: brand.color, companyName: brand.companyName },
      footer: renderFooter(brand),
    });

    const text =
      `${heading}\n\n${intro}\n\n` +
      `API: ${row.api_name}\nPlan: ${row.plan_name}\n${isFree ? "Sandbox ends" : "Renews"}: ${renews}\n\n` +
      `${isFree ? "Upgrade" : "Review"}: ${appUrl()}/${isFree ? "pricing" : "dashboard"}\n`;

    const sent = await sendEmail({
      to: row.email,
      subject,
      html,
      text,
    });

    if (sent.ok) {
      result.sent += 1;
      await sql`
        UPDATE notifications SET status = 'sent', detail = ${sent.id}
        WHERE subscription_id = ${row.subscription_id} AND kind = ${kind} AND period_end = ${row.period_end}
      `;
      result.details.push(`sent ${kind} to ${row.email} (${row.api_name})`);
    } else {
      result.failed += 1;
      // Recorded as failed rather than deleted, so a broken provider is visible
      // in the console instead of silently retrying every day.
      await sql`
        UPDATE notifications SET status = 'failed', detail = ${sent.error}
        WHERE subscription_id = ${row.subscription_id} AND kind = ${kind} AND period_end = ${row.period_end}
      `;
      result.details.push(`FAILED ${row.email}: ${sent.error}`);
    }
  }

  return result;
}

export async function listNotifications(limit = 50) {
  return sql<
    {
      id: string;
      email: string;
      api_name: string | null;
      kind: string;
      status: string;
      detail: string;
      created_at: Date;
    }[]
  >`
    SELECT n.id, u.email, a.name AS api_name, n.kind, n.status, n.detail, n.created_at
    FROM notifications n
    JOIN users u ON u.id = n.user_id
    LEFT JOIN subscriptions s ON s.id = n.subscription_id
    LEFT JOIN apis a ON a.id = s.api_id
    ORDER BY n.created_at DESC
    LIMIT ${limit}
  `;
}
