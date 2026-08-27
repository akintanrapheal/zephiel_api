import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "GDPR compliance",
  description:
    "How Zephiel API handles personal data under the GDPR: lawful bases, data categories, retention, subprocessors, international transfers, and how to exercise your rights.",
};

const LAST_UPDATED = "27 August 2026";

const dataCategories = [
  {
    category: "Account details",
    examples: "Name, email address, hashed password",
    purpose: "Creating and securing your account",
    basis: "Contract",
    retention: "Until you delete the account",
  },
  {
    category: "API credentials",
    examples: "Key prefix and a SHA-256 digest of each key",
    purpose: "Authenticating gateway requests",
    basis: "Contract",
    retention: "Until the key is revoked, then 30 days",
  },
  {
    category: "Request metadata",
    examples: "Timestamp, endpoint, HTTP status, latency",
    purpose: "Metering usage and enforcing quotas",
    basis: "Contract",
    retention: "13 months, then aggregated",
  },
  {
    category: "Billing records",
    examples: "Plan, amount, currency, payment reference, status",
    purpose: "Taking payment and meeting accounting duties",
    basis: "Contract / legal obligation",
    retention: "7 years (statutory)",
  },
  {
    category: "Session data",
    examples: "Opaque session identifier, expiry",
    purpose: "Keeping you signed in",
    basis: "Contract",
    retention: "30 days, or until sign-out",
  },
  {
    category: "Server logs",
    examples: "IP address, user agent, referring page",
    purpose: "Security, abuse prevention, diagnostics",
    basis: "Legitimate interests",
    retention: "30 days",
  },
];

const subprocessors = [
  {
    name: "Vercel",
    role: "Application hosting and edge delivery",
    data: "Request metadata, IP addresses",
    location: "United States / EU regions",
  },
  {
    name: "Neon",
    role: "Managed PostgreSQL database",
    data: "All stored account, usage, and billing data",
    location: "EU (London)",
  },
  {
    name: "Paystack",
    role: "Payment processing",
    data: "Email address, transaction amount and reference",
    location: "Nigeria / South Africa",
  },
];

const rights = [
  { name: "Access", detail: "Ask for a copy of the personal data we hold about you." },
  { name: "Rectification", detail: "Have inaccurate details corrected — most are editable in your dashboard." },
  { name: "Erasure", detail: "Ask us to delete your account and associated data, subject to records we must keep by law." },
  { name: "Restriction", detail: "Ask us to pause processing while a dispute about accuracy or legitimacy is resolved." },
  { name: "Portability", detail: "Receive your account and usage data in a structured, machine-readable format." },
  { name: "Objection", detail: "Object to processing carried out on the basis of legitimate interests." },
  { name: "Withdraw consent", detail: "Where processing relies on consent, withdraw it at any time without affecting prior processing." },
];

export default function GdprPage() {
  return (
    <article className="max-w-3xl">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">Compliance</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          GDPR compliance
        </h1>
        <p className="mt-3 text-sm text-muted">Last updated {LAST_UPDATED}</p>
      </header>

      <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
        <p className="text-sm leading-6 text-muted">
          <span className="font-semibold text-ink">This is a demonstration project.</span> The text below
          is a worked example of what a GDPR page should cover, not legal advice, and the platform is not
          currently operated as a live commercial service. Have a qualified data protection adviser review
          and adapt it before publishing it for a real product.
        </p>
      </div>

      <p className="mt-8 text-[15px] leading-8 text-muted">
        The General Data Protection Regulation gives people in the European Economic Area and the United
        Kingdom rights over how their personal data is handled. This page explains what Zephiel collects,
        why, how long it is kept, who else processes it, and how to exercise those rights.
      </p>

      <Section id="roles" title="Our role">
        <p>
          For your Zephiel account — your name, email, keys, usage, and invoices — we act as the{" "}
          <strong className="font-semibold text-ink">data controller</strong>. We decide what is collected
          and why.
        </p>
        <p>
          For data you send <em>through</em> the gateway to a listed API, we act as a{" "}
          <strong className="font-semibold text-ink">data processor</strong>. We forward the request,
          record only its metadata, and do not retain request or response bodies. Each listing names its
          provider so you can assess where that payload goes before subscribing.
        </p>
        <p>
          If you send personal data through an API, you are the controller for that data and are
          responsible for having a lawful basis to do so.
        </p>
      </Section>

      <Section id="lawful-bases" title="Lawful bases">
        <p>We rely on four bases, depending on the purpose:</p>
        <ul className="mt-3 space-y-2">
          {[
            ["Performance of a contract", "running your account, issuing keys, metering calls, taking payment"],
            ["Legitimate interests", "securing the platform, preventing abuse, diagnosing faults"],
            ["Legal obligation", "keeping financial records for the statutory period"],
            ["Consent", "any optional communication you opt into, withdrawable at any time"],
          ].map(([basis, use]) => (
            <li key={basis} className="flex gap-3">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
              <span>
                <strong className="font-semibold text-ink">{basis}</strong> — {use}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="data" title="What we process">
        <p>Every category of personal data the platform stores, and how long it is kept:</p>
        <div className="mt-5 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <caption className="sr-only">
              Personal data categories, purpose, lawful basis, and retention period
            </caption>
            <thead>
              <tr className="bg-elevated text-left">
                <th scope="col" className="px-4 py-3 font-semibold text-ink">Category</th>
                <th scope="col" className="px-4 py-3 font-semibold text-ink">Examples</th>
                <th scope="col" className="px-4 py-3 font-semibold text-ink">Purpose</th>
                <th scope="col" className="px-4 py-3 font-semibold text-ink">Basis</th>
                <th scope="col" className="px-4 py-3 font-semibold text-ink">Retention</th>
              </tr>
            </thead>
            <tbody>
              {dataCategories.map((d, i) => (
                <tr key={d.category} className={i % 2 ? "bg-elevated/40" : "bg-surface"}>
                  <td className="px-4 py-3 font-medium text-ink">{d.category}</td>
                  <td className="px-4 py-3 text-muted">{d.examples}</td>
                  <td className="px-4 py-3 text-muted">{d.purpose}</td>
                  <td className="px-4 py-3 text-muted">{d.basis}</td>
                  <td className="px-4 py-3 text-muted">{d.retention}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4">
          We do not sell personal data, and we do not use it to train models.
        </p>
      </Section>

      <Section id="rights" title="Your rights">
        <p>
          If you are in the EEA or UK you have the following rights. Exercise any of them by emailing{" "}
          <a href="mailto:privacy@zephiel.dev" className="font-medium text-brand-600 hover:underline">
            privacy@zephiel.dev
          </a>{" "}
          — we respond within 30 days.
        </p>
        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          {rights.map((r) => (
            <div key={r.name} className="rounded-xl border border-line bg-surface p-4">
              <dt className="text-sm font-semibold text-ink">{r.name}</dt>
              <dd className="mt-1 text-sm leading-6 text-muted">{r.detail}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4">
          You also have the right to complain to your local supervisory authority. We would appreciate the
          chance to resolve it with you first.
        </p>
      </Section>

      <Section id="subprocessors" title="Subprocessors">
        <p>
          These providers process personal data on our behalf under written agreements that impose
          equivalent obligations. We give notice before adding a new one.
        </p>
        <div className="mt-5 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <caption className="sr-only">Subprocessors, their role, the data they handle, and location</caption>
            <thead>
              <tr className="bg-elevated text-left">
                <th scope="col" className="px-4 py-3 font-semibold text-ink">Provider</th>
                <th scope="col" className="px-4 py-3 font-semibold text-ink">Role</th>
                <th scope="col" className="px-4 py-3 font-semibold text-ink">Data handled</th>
                <th scope="col" className="px-4 py-3 font-semibold text-ink">Location</th>
              </tr>
            </thead>
            <tbody>
              {subprocessors.map((s, i) => (
                <tr key={s.name} className={i % 2 ? "bg-elevated/40" : "bg-surface"}>
                  <td className="px-4 py-3 font-medium text-ink">{s.name}</td>
                  <td className="px-4 py-3 text-muted">{s.role}</td>
                  <td className="px-4 py-3 text-muted">{s.data}</td>
                  <td className="px-4 py-3 text-muted">{s.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4">
          Third-party API providers listed on the marketplace are not our subprocessors — when you
          subscribe to one you form your own relationship with that provider for the payloads you send it.
        </p>
      </Section>

      <Section id="transfers" title="International transfers">
        <p>
          Our primary database is hosted in the EU. Where data reaches a provider outside the EEA or UK,
          the transfer is covered by the European Commission&apos;s Standard Contractual Clauses together
          with a transfer risk assessment, or by an adequacy decision where one applies.
        </p>
      </Section>

      <Section id="cookies" title="Cookies and logs">
        <p>
          Zephiel sets one cookie: an opaque session identifier that keeps you signed in. It is
          <code className="mx-1 rounded bg-elevated px-1.5 py-0.5 font-mono text-xs text-ink">httpOnly</code>
          and
          <code className="mx-1 rounded bg-elevated px-1.5 py-0.5 font-mono text-xs text-ink">SameSite=Lax</code>,
          expires after 30 days, and is strictly necessary — so it does not require consent. Your theme
          preference is stored in <code className="rounded bg-elevated px-1.5 py-0.5 font-mono text-xs text-ink">localStorage</code>,
          never sent to us.
        </p>
        <p>
          We run no advertising, analytics, or third-party tracking scripts. Server logs record IP address,
          user agent, and referrer for 30 days for security and diagnostics.
        </p>
      </Section>

      <Section id="security" title="Security measures">
        <ul className="mt-3 space-y-2">
          {[
            "Passwords hashed with scrypt and a per-user salt — never stored or logged in plaintext.",
            "API keys stored only as SHA-256 digests; the plaintext is shown once and cannot be recovered.",
            "Sessions are opaque random identifiers checked against the database on every request, so revocation is immediate.",
            "All traffic served over TLS; database connections require TLS.",
            "Every database query is parameterised, eliminating SQL injection.",
            "Administrative areas are role-gated and excluded from search indexing.",
          ].map((item) => (
            <li key={item} className="flex gap-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="mt-1.5 h-3.5 w-3.5 shrink-0 text-accent">
                <path d="M4 12.5l5 5L20 6.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="children" title="Children">
        <p>
          Zephiel is a developer tool intended for people aged 16 and over. We do not knowingly collect
          data from children. If you believe a child has created an account, contact us and we will remove
          it.
        </p>
      </Section>

      <Section id="breach" title="Breach notification">
        <p>
          If a personal data breach occurs that is likely to result in a risk to your rights, we will
          notify the relevant supervisory authority within 72 hours of becoming aware of it, and tell
          affected customers without undue delay.
        </p>
      </Section>

      <Section id="dpa" title="Data processing agreement">
        <p>
          If you need a signed DPA incorporating the Standard Contractual Clauses, request one at{" "}
          <a href="mailto:privacy@zephiel.dev" className="font-medium text-brand-600 hover:underline">
            privacy@zephiel.dev
          </a>{" "}
          and we will return a countersigned copy.
        </p>
      </Section>

      <div className="mt-12 rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-base font-semibold tracking-tight text-ink">Questions about your data?</h2>
        <p className="mt-2 text-sm leading-7 text-muted">
          Write to our data protection contact and we will get back to you within 30 days.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href="mailto:privacy@zephiel.dev"
            className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            privacy@zephiel.dev
          </a>
          <Link
            href="/legal/terms"
            className="rounded-xl border border-line px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-elevated"
          >
            Terms &amp; Privacy
          </Link>
        </div>
      </div>
    </article>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-10 scroll-mt-24">
      <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-8 text-muted">{children}</div>
    </section>
  );
}
