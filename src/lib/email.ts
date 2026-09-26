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
  /** Files to attach. `content` is the raw bytes; base64 is done here. */
  attachments?: { filename: string; content: Uint8Array }[];
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
        ...(params.attachments?.length
          ? {
              attachments: params.attachments.map((a) => ({
                filename: a.filename,
                content: Buffer.from(a.content).toString("base64"),
              })),
            }
          : {}),
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

/** Logo + wordmark + footer identity for the top and bottom of a message. */
export type EmailBrand = {
  logoUrl?: string;
  color?: string;
  companyName?: string;
  companyAddress?: string;
  supportEmail?: string;
};

/**
 * Shared shell so every message looks like it came from the same product.
 *
 * Laid out like the polished lifecycle emails customers expect: a centred logo,
 * a large heading, the body, a primary button with an optional secondary link,
 * and a footer carrying the company name, address and a support link.
 */
export function emailShell(opts: {
  heading: string;
  intro: string;
  rows?: { label: string; value: string }[];
  bodyNote?: string;
  ctaLabel?: string;
  ctaHref?: string;
  /** A quieter text link shown under the primary button (e.g. "Go to billing settings"). */
  ctaSecondaryLabel?: string;
  ctaSecondaryHref?: string;
  footer?: string;
  brand?: EmailBrand;
}) {
  const brandColor = safeColor(opts.brand?.color) ?? "#2445d6";
  const company = opts.brand?.companyName ?? "Zephiel API";
  const address = opts.brand?.companyAddress?.trim();
  const support = opts.brand?.supportEmail?.trim();

  const rows = (opts.rows ?? [])
    .map(
      (r) => `
        <tr>
          <td style="padding:8px 0;color:#64748b;font-size:14px;">${escapeHtml(r.label)}</td>
          <td style="padding:8px 0;color:#0f172a;font-size:14px;font-weight:600;text-align:right;">${escapeHtml(r.value)}</td>
        </tr>`
    )
    .join("");

  // Intro may carry paragraph breaks (\n\n) — render each as its own <p>.
  const introHtml = escapeHtml(opts.intro)
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p style="margin:14px 0 0;font-size:15px;line-height:1.7;color:#334155;">${p.replace(/\n/g, "<br>")}</p>`
    )
    .join("");

  const cta =
    opts.ctaHref && opts.ctaLabel
      ? `<div style="margin-top:28px;"><a href="${opts.ctaHref}" style="display:inline-block;background:${brandColor};color:#ffffff;text-decoration:none;padding:13px 26px;border-radius:12px;font-size:15px;font-weight:600;">${escapeHtml(opts.ctaLabel)}</a></div>`
      : "";

  const ctaSecondary =
    opts.ctaSecondaryHref && opts.ctaSecondaryLabel
      ? `<div style="margin-top:14px;"><a href="${opts.ctaSecondaryHref}" style="color:#475569;text-decoration:none;font-size:14px;font-weight:600;border-bottom:1px solid #cbd5e1;padding-bottom:1px;">${escapeHtml(opts.ctaSecondaryLabel)}</a></div>`
      : "";

  // Logo image when configured, with the wordmark as its alt text so a client
  // that blocks images still shows the brand name.
  const brandmark = opts.brand?.logoUrl
    ? `<img src="${escapeHtml(opts.brand.logoUrl)}" alt="${escapeHtml(company)}" height="34" style="height:34px;width:auto;display:inline-block;border:0;outline:none;text-decoration:none;" />`
    : `<div style="font-size:17px;font-weight:700;color:#0f172a;">${escapeHtml(company)}</div>`;

  const footerLine = opts.footer ?? `You are receiving this because you have an account on ${company}.`;
  const footerBits = [
    `<div style="font-weight:600;color:#475569;">${escapeHtml(company)}</div>`,
    address ? `<div style="margin-top:4px;">${escapeHtml(address).replace(/\n/g, "<br>")}</div>` : "",
    support
      ? `<div style="margin-top:8px;"><a href="mailto:${escapeHtml(support)}" style="color:#94a3b8;text-decoration:underline;">Help</a></div>`
      : "",
    `<div style="margin-top:10px;">${escapeHtml(footerLine)}</div>`,
  ]
    .filter(Boolean)
    .join("");

  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f4f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:18px;border:1px solid #e6eaf1;">
    <tr><td style="padding:40px 40px 36px;">
      <div style="text-align:center;margin-bottom:28px;">${brandmark}</div>
      <h1 style="margin:0;font-size:26px;line-height:1.25;font-weight:700;color:#0f172a;letter-spacing:-0.4px;">${escapeHtml(opts.heading)}</h1>
      ${introHtml}
      ${rows ? `<table role="presentation" width="100%" style="margin-top:24px;border-top:1px solid #e6eaf1;">${rows}</table>` : ""}
      ${opts.bodyNote ? `<p style="margin:22px 0 0;font-size:14px;line-height:1.7;color:#64748b;">${escapeHtml(opts.bodyNote)}</p>` : ""}
      ${cta}
      ${ctaSecondary}
    </td></tr>
  </table>
  <div style="max-width:560px;margin:22px auto 0;font-size:12px;line-height:1.6;color:#94a3b8;text-align:center;">
    ${footerBits}
  </div>
</body></html>`;
}

/** Only allow a hex colour into an inline style. */
function safeColor(v: string | undefined): string | null {
  return v && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v.trim()) ? v.trim() : null;
}

function escapeHtml(v: string) {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
