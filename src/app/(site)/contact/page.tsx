import type { Metadata } from "next";
import ContactForm from "@/components/ContactForm";

export const metadata: Metadata = {
  title: "Contact",
  description: "Talk to the Zephiel team about pricing, enterprise plans, or listing your API.",
};

const offices = [
  {
    city: "Houston, Texas",
    role: "Headquarters",
    lines: ["1200 Smith Street, Suite 1600", "Houston, TX 77002", "United States"],
    hours: "Mon–Fri, 9:00–18:00 CT",
  },
  {
    city: "Cape Town",
    role: "Regional office — Africa",
    lines: ["The Foundry, Cardiff Street", "Green Point, Cape Town 8005", "South Africa"],
    hours: "Mon–Fri, 9:00–18:00 SAST",
  },
];

const channels = [
  { title: "Sales", body: "Volume pricing, enterprise SLAs, and procurement paperwork.", meta: "info@zephiel.com" },
  { title: "Support", body: "Integration questions and incidents. Priority routing on paid plans.", meta: "info@zephiel.com" },
  { title: "Providers", body: "Listing an API on the marketplace.", meta: "info@zephiel.com" },
];

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Get in touch</h1>
        <p className="mt-4 text-[15px] leading-7 text-muted">
          Tell us what you are building and we will point you at the right plan — or tell you honestly if
          the free tier is already enough.
        </p>
      </header>

      <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_320px]">
        <ContactForm />

        <aside className="space-y-4">
          {offices.map((o) => (
            <div key={o.city} className="rounded-2xl border border-line bg-surface p-6">
              <h2 className="text-[15px] font-semibold tracking-tight text-ink">{o.city}</h2>
              <p className="mt-1 text-xs font-medium uppercase tracking-wider text-muted">{o.role}</p>
              <address className="mt-3 text-sm not-italic leading-7 text-muted">
                {o.lines.map((l) => (
                  <span key={l} className="block">
                    {l}
                  </span>
                ))}
              </address>
              <p className="mt-3 text-xs text-muted">{o.hours}</p>
            </div>
          ))}

          {channels.map((c) => (
            <div key={c.title} className="rounded-2xl border border-line bg-surface p-5">
              <h2 className="text-sm font-semibold tracking-tight text-ink">{c.title}</h2>
              <p className="mt-1.5 text-sm leading-6 text-muted">{c.body}</p>
              <p className="mt-2 font-mono text-xs text-brand-600">{c.meta}</p>
            </div>
          ))}
          <div className="rounded-2xl border border-line bg-elevated p-5">
            <p className="text-xs leading-6 text-muted">
              Median first response: <span className="font-semibold text-ink">3h 20m</span> on business days.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
