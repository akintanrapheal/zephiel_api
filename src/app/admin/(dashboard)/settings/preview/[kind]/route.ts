import { getCurrentUser } from "@/lib/auth";
import { sampleInvoiceDocument } from "@/server/invoices";
import { renderInvoiceHtml } from "@/lib/invoice";
import { emailShell } from "@/lib/email";
import { getBranding, renderFooter, emailBrand } from "@/lib/branding";
import { getTemplates, fillTemplate, type TemplateKind } from "@/lib/email-templates";
import { appUrl } from "@/lib/app-url";

const DOCUMENTS = new Set(["receipt", "invoice"]);
const SHELL: Record<string, { templateKey: TemplateKind; cta: string; href: string; secondary?: string; secondaryHref?: string }> = {
  reminder: { templateKey: "renewal", cta: "Review subscription", href: "/dashboard" },
  sandbox: { templateKey: "sandbox", cta: "Upgrade now", href: "/pricing" },
  paused: { templateKey: "paused", cta: "Pay invoice", href: "/dashboard/billing", secondary: "Go to billing settings", secondaryHref: "/dashboard" },
  cancelled: { templateKey: "cancelled", cta: "Resubscribe", href: "/pricing" },
};

/** Preview a document or email in the browser without sending anything. */
export async function GET(_request: Request, { params }: { params: Promise<{ kind: string }> }) {
  // Checked rather than delegated to requireAdmin(): that redirects, which a
  // route handler cannot do from here, and the throw surfaced as a 500.
  const user = await getCurrentUser();
  if (user?.role !== "admin") return new Response("Not found", { status: 404 });

  const { kind } = await params;
  const html = (body: string) =>
    new Response(body, {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });

  if (DOCUMENTS.has(kind)) {
    return html(renderInvoiceHtml(await sampleInvoiceDocument(kind as "receipt" | "invoice")));
  }

  const spec = SHELL[kind];
  if (!spec) return new Response("Unknown document", { status: 404 });

  const [brand, templates] = await Promise.all([getBranding(), getTemplates()]);
  const renews = new Date(Date.now() + 6048e5).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const t = fillTemplate(templates[spec.templateKey], {
    firstName: " Jane",
    name: "Jane Doe",
    api: "Multistore",
    plan: "Standard (3 stores)",
    days: "7",
    date: renews,
    amount: "$15.00",
    company: brand.companyName,
  });

  return html(
    emailShell({
      heading: t.heading,
      intro: t.intro,
      rows: [
        { label: "API", value: "Multistore" },
        { label: "Plan", value: "Standard (3 stores)" },
        ...(kind === "reminder" ? [{ label: "Renews", value: renews }] : []),
      ],
      bodyNote: t.note,
      ctaLabel: spec.cta,
      ctaHref: `${appUrl()}${spec.href}`,
      ctaSecondaryLabel: spec.secondary,
      ctaSecondaryHref: spec.secondaryHref ? `${appUrl()}${spec.secondaryHref}` : undefined,
      brand: emailBrand(brand),
      footer: renderFooter(brand),
    })
  );
}
