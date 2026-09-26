import "server-only";
import { getSettings } from "./settings";
import { appUrl } from "./app-url";

export type Branding = {
  /** Absolute URL to the logo shown at the top of every message and document. */
  logoUrl: string;
  /** Accent colour (hex) for buttons, the wordmark and document highlights. */
  color: string;
  /** Footer line shown under every email. */
  footer: string;
  /** Display name used in the wordmark and as {company} in copy. */
  companyName: string;
  /** Registered address, shown in the email footer (like Anthropic's). */
  companyAddress: string;
  supportEmail: string;
  /** Privacy policy URL for the footer's "Help · Privacy" links. */
  privacyUrl: string;
  /** Social profile links shown as small text links in the footer. */
  socials: { label: string; url: string }[];
};

/** Sensible defaults so a fresh install is already branded before anyone edits. */
export function defaultBranding(): Branding {
  return {
    // logo-192.png ships in /public; an absolute URL is required because email
    // clients cannot resolve a relative path.
    logoUrl: `${appUrl()}/logo-192.png`,
    color: "#2445d6",
    footer: "You are receiving this because you have an account on {company}.",
    companyName: "Zephiel API",
    companyAddress: "",
    supportEmail: "support@zephiel.com",
    privacyUrl: "",
    socials: [],
  };
}

/**
 * Branding for the current install, admin overrides layered over the defaults.
 *
 * One place every email/document reads from, so a logo or colour change in the
 * console takes effect everywhere at once with no code change.
 */
export async function getBranding(): Promise<Branding> {
  const settings = await getSettings().catch(() => ({}) as Record<string, string>);
  const d = defaultBranding();

  const companyName =
    settings.company_name || settings.platform_name || d.companyName;

  const socials = (
    [
      ["X", settings.social_x],
      ["LinkedIn", settings.social_linkedin],
      ["Instagram", settings.social_instagram],
      ["YouTube", settings.social_youtube],
    ] as const
  )
    .filter(([, url]) => !!url && /^https?:\/\//i.test(url))
    .map(([label, url]) => ({ label, url: url as string }));

  return {
    logoUrl: settings.brand_logo_url || d.logoUrl,
    color: isHexColor(settings.brand_color) ? settings.brand_color! : d.color,
    footer: settings.email_footer || d.footer,
    companyName,
    companyAddress: settings.company_address || d.companyAddress,
    supportEmail: settings.support_email || d.supportEmail,
    privacyUrl: settings.privacy_url || d.privacyUrl,
    socials,
  };
}

/** The footer line with {company} filled in. */
export function renderFooter(brand: Branding): string {
  return brand.footer.replace(/\{company\}/g, brand.companyName);
}

/** The subset of branding the email shell needs, in one object. */
export function emailBrand(brand: Branding) {
  return {
    logoUrl: brand.logoUrl,
    color: brand.color,
    companyName: brand.companyName,
    companyAddress: brand.companyAddress,
    supportEmail: brand.supportEmail,
    privacyUrl: brand.privacyUrl,
    socials: brand.socials,
  };
}

/** True for #rgb / #rrggbb, the only forms we let into inline styles. */
export function isHexColor(v: string | undefined | null): boolean {
  return !!v && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v.trim());
}
