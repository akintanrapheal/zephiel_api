import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms & Privacy",
  description: "Terms of service and privacy summary for the Zephiel API platform.",
};

const sections = [
  {
    h: "1. Using the platform",
    p: "Your Zephiel account gives you access to APIs supplied by us and by third-party providers listed on the marketplace. You are responsible for keeping your API keys secret and for all traffic made with them. Keys found in public repositories are revoked automatically.",
  },
  {
    h: "2. Acceptable use",
    p: "Do not use the platform to build systems that violate applicable law, infringe others' rights, or attempt to circumvent rate limits or quotas. Scraping endpoints must be used in line with the target site's terms and robots directives.",
  },
  {
    h: "3. Plans, quotas, and billing",
    p: "Plans renew monthly until cancelled. Calls that exceed quota are billed at the published overage rate rather than blocked. Requests failing with a 4xx validation error or a 5xx platform error are not billed.",
  },
  {
    h: "4. Availability",
    p: "Paid plans carry the uptime commitment shown on the pricing page, measured monthly and excluding scheduled maintenance announced at least 72 hours in advance. Credits are the sole remedy for missed targets.",
  },
  {
    h: "5. Data we process",
    p: "We store account details, billing records, and request metadata — timestamp, endpoint, status code, and latency. We do not retain request or response bodies except where you explicitly enable debug logging, which expires after seven days.",
  },
  {
    h: "6. Third-party providers",
    p: "When you call a provider's API, the request payload is forwarded to that provider. Each listing names its provider so you can assess where your data goes before subscribing. Data processing agreements are available on paid plans.",
  },
  {
    h: "7. Termination",
    p: "You may cancel at any time from the dashboard; access continues until the end of the paid period. We may suspend accounts for non-payment or for acceptable-use violations, with notice where circumstances allow.",
  },
];

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Terms &amp; Privacy</h1>
      <p className="mt-3 text-sm text-muted">Last updated August 26, 2026</p>

      <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
        <p className="text-sm leading-6 text-muted">
          This is placeholder copy for a demo project, not legal advice. Replace it with terms reviewed by
          a qualified lawyer before running a real service.
        </p>
      </div>

      <div className="mt-10 space-y-8">
        {sections.map((s) => (
          <section key={s.h}>
            <h2 className="text-base font-semibold tracking-tight text-ink">{s.h}</h2>
            <p className="mt-2 text-sm leading-7 text-muted">{s.p}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
