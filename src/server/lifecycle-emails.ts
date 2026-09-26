import "server-only";
import { getEmailConfig, sendEmail, emailShell } from "@/lib/email";
import { getBranding, renderFooter, emailBrand } from "@/lib/branding";
import { getTemplates, fillTemplate } from "@/lib/email-templates";
import { appUrl } from "@/lib/app-url";

/**
 * Notify a customer that their subscription was cancelled.
 *
 * Best-effort and self-contained so the cancel flow can fire it without wiring
 * up branding or templates; it never throws, so a mail hiccup cannot fail the
 * cancellation itself.
 */
export async function sendCancellationEmail(params: {
  to: string;
  name?: string | null;
  api?: string | null;
  plan?: string | null;
}): Promise<void> {
  try {
    if (!(await getEmailConfig()).apiKey) return;

    const [brand, templates] = await Promise.all([getBranding(), getTemplates()]);
    const firstName = params.name ? ` ${params.name.split(" ")[0]}` : "";
    const t = fillTemplate(templates.cancelled, {
      firstName,
      name: params.name ?? "",
      api: params.api || `your ${brand.companyName} subscription`,
      plan: params.plan ?? "",
      date: "",
      company: brand.companyName,
    });

    await sendEmail({
      to: params.to,
      subject: t.subject,
      html: emailShell({
        heading: t.heading,
        intro: t.intro,
        bodyNote: t.note,
        ctaLabel: "Resubscribe",
        ctaHref: `${appUrl()}/pricing`,
        brand: emailBrand(brand),
        footer: renderFooter(brand),
      }),
      text: `${t.heading}\n\n${t.intro}`,
    });
  } catch (err) {
    console.error("Cancellation email failed:", err);
  }
}
