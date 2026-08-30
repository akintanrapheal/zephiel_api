import "server-only";
import { getSettings } from "./settings";

export type EmailConfig = {
  apiKey: string | null;
  from: string;
  source: "settings" | "env" | "none";
};

/**
 * Email is sent through Resend's HTTP API — no SDK, so nothing new to install
 * and nothing to keep in step. Swap `send` for another provider by changing
 * this one function; callers only see `sendEmail`.
 */
export async function getEmailConfig(): Promise<EmailConfig> {
  const settings = await getSettings().catch(() => ({}) as Record<string, string>);

  const fromSettings = settings.resend_api_key;
  const fromEnv = process.env.RESEND_API_KEY;

  return {
    apiKey: fromSettings ?? fromEnv ?? null,
    from: settings.email_from ?? process.env.EMAIL_FROM ?? "Zephiel API <info@zephiel.com>",
    source: fromSettings ? "settings" : fromEnv ? "env" : "none",
  };
}

export async function isEmailConfigured() {
  return Boolean((await getEmailConfig()).apiKey);
}

export type SendResult = { ok: true; id: string } | { ok: false; error: string };

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> {
  const config = await getEmailConfig();
  if (!config.apiKey) return { ok: false, error: "No email provider configured." };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.from,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text,
      }),
      cache: "no-store",
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      return { ok: false, error: body?.message ?? `Provider returned ${res.status}.` };
    }
    return { ok: true, id: body?.id ?? "sent" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Send failed." };
  }
}

/** Shared shell so every message looks like it came from the same product. */
export function emailShell(opts: {
  heading: string;
  intro: string;
  rows?: { label: string; value: string }[];
  bodyNote?: string;
  ctaLabel?: string;
  ctaHref?: string;
  footer?: string;
}) {
  const rows = (opts.rows ?? [])
    .map(
      (r) => `
        <tr>
          <td style="padding:6px 0;color:#64748b;font-size:14px;">${escapeHtml(r.label)}</td>
          <td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;text-align:right;">${escapeHtml(r.value)}</td>
        </tr>`
    )
    .join("");

  const cta =
    opts.ctaHref && opts.ctaLabel
      ? `<a href="${opts.ctaHref}" style="display:inline-block;margin-top:24px;background:#2445d6;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-size:14px;font-weight:600;">${escapeHtml(opts.ctaLabel)}</a>`
      : "";

  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f4f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;">
    <tr><td style="padding:32px;">
      <div style="font-size:15px;font-weight:700;color:#0f172a;">Zephiel API</div>
      <h1 style="margin:20px 0 0;font-size:20px;line-height:1.35;color:#0f172a;">${escapeHtml(opts.heading)}</h1>
      <p style="margin:12px 0 0;font-size:15px;line-height:1.7;color:#475569;">${escapeHtml(opts.intro)}</p>
      ${rows ? `<table role="presentation" style="width:100%;margin-top:22px;border-top:1px solid #e2e8f0;">${rows}</table>` : ""}
      ${opts.bodyNote ? `<p style="margin:20px 0 0;font-size:14px;line-height:1.7;color:#475569;">${escapeHtml(opts.bodyNote)}</p>` : ""}
      ${cta}
    </td></tr>
  </table>
  <p style="max-width:560px;margin:16px auto 0;font-size:12px;line-height:1.6;color:#94a3b8;text-align:center;">
    ${escapeHtml(opts.footer ?? "You are receiving this because you have an active subscription on Zephiel API.")}
  </p>
</body></html>`;
}

function escapeHtml(v: string) {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
