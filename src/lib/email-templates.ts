import "server-only";
import { getSettings } from "./settings";

/**
 * The message types whose wording an admin can edit.
 *
 * `renewal` and `sandbox` are the automatic reminders; `receipt`, `invoice`
 * and `test` are the structured documents / test send, where only the subject
 * line is copy (the body is a rendered document).
 */
export type TemplateKind = "renewal" | "sandbox" | "receipt" | "invoice" | "test";

export type Template = {
  subject: string;
  heading: string;
  intro: string;
  /** Secondary paragraph under the details table. */
  note: string;
};

export const TEMPLATE_LABELS: Record<TemplateKind, string> = {
  renewal: "Paid renewal reminder",
  sandbox: "Free sandbox — upgrade reminder",
  receipt: "Payment receipt",
  invoice: "Invoice (amount due)",
  test: "Test email",
};

/**
 * Placeholders each template understands. Substituted with the real values at
 * send time; anything not listed is left untouched so stray braces are harmless.
 */
export const TEMPLATE_PLACEHOLDERS: Record<TemplateKind, string[]> = {
  renewal: ["{firstName}", "{name}", "{api}", "{plan}", "{days}", "{date}", "{amount}", "{company}"],
  sandbox: ["{firstName}", "{name}", "{api}", "{plan}", "{days}", "{date}", "{company}"],
  receipt: ["{company}", "{invoiceNumber}", "{amount}"],
  invoice: ["{company}", "{invoiceNumber}", "{amount}"],
  test: ["{company}"],
};

export const DEFAULT_TEMPLATES: Record<TemplateKind, Template> = {
  renewal: {
    subject: "{api} renews in {days} days",
    heading: "{api} renews in {days} days",
    intro:
      "Hello{firstName}, your {api} subscription is due to renew on {date}. If it lapses, calls from your integration start returning 403 and any sync running against it will fail until the plan is active again.",
    note:
      "No action is needed if your payment method is current — this is a heads-up so a lapsed plan never surprises your production traffic.",
  },
  sandbox: {
    subject: "Your free {api} sandbox ends in {days} days",
    heading: "Your free {api} sandbox ends in {days} days",
    intro:
      "Hello{firstName}, your free {api} sandbox access ends on {date}. Upgrade to a paid plan before then to keep your integration running — once the sandbox ends, calls from your project start returning 403 errors and any sync against it will fail until you upgrade.",
    note:
      "Upgrading takes a minute and keeps your API keys and connected stores exactly as they are — only the limits and billing change. Do it before the date above to avoid any interruption.",
  },
  receipt: {
    subject: "{company} receipt {invoiceNumber} — {amount}",
    heading: "",
    intro: "",
    note: "",
  },
  invoice: {
    subject: "{company} invoice {invoiceNumber} — {amount} due",
    heading: "",
    intro: "",
    note: "",
  },
  test: {
    subject: "{company} — test email",
    heading: "Your email settings work",
    intro:
      "This is a test message from the {company} admin console. Renewal reminders will look like this.",
    note: "Sent manually from the admin console.",
  },
};

/** Replace {placeholder} tokens with real values. Unknown tokens are left as-is. */
export function fillTemplate(t: Template, vars: Record<string, string>): Template {
  const apply = (s: string) =>
    s.replace(/\{(\w+)\}/g, (m, key) => (key in vars ? vars[key] : m));
  return {
    subject: apply(t.subject),
    heading: apply(t.heading),
    intro: apply(t.intro),
    note: apply(t.note),
  };
}

type StoredTemplates = Partial<Record<TemplateKind, Partial<Template>>>;

function parseStored(raw: string | undefined): StoredTemplates {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as StoredTemplates) : {};
  } catch {
    return {};
  }
}

/** Defaults with any admin overrides layered on, field by field. */
export async function getTemplates(): Promise<Record<TemplateKind, Template>> {
  const settings = await getSettings().catch(() => ({}) as Record<string, string>);
  const stored = parseStored(settings.email_templates);

  const out = {} as Record<TemplateKind, Template>;
  for (const kind of Object.keys(DEFAULT_TEMPLATES) as TemplateKind[]) {
    const base = DEFAULT_TEMPLATES[kind];
    const over = stored[kind] ?? {};
    out[kind] = {
      subject: (over.subject ?? "").trim() || base.subject,
      heading: over.heading !== undefined ? over.heading : base.heading,
      intro: over.intro !== undefined ? over.intro : base.intro,
      note: over.note !== undefined ? over.note : base.note,
    };
  }
  return out;
}

/** Serialise the edited set for storage, dropping fields equal to the default. */
export function serialiseTemplates(edited: Record<TemplateKind, Template>): string {
  const diff: StoredTemplates = {};
  for (const kind of Object.keys(DEFAULT_TEMPLATES) as TemplateKind[]) {
    const base = DEFAULT_TEMPLATES[kind];
    const cur = edited[kind];
    const changed: Partial<Template> = {};
    (Object.keys(base) as (keyof Template)[]).forEach((f) => {
      if ((cur[f] ?? "") !== base[f]) changed[f] = cur[f];
    });
    if (Object.keys(changed).length) diff[kind] = changed;
  }
  return JSON.stringify(diff);
}
