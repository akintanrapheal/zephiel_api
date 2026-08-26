import type { Metadata } from "next";
import ContactForm from "@/components/ContactForm";

export const metadata: Metadata = {
  title: "Contact",
  description: "Talk to the Zephiel team about pricing, enterprise plans, or listing your API.",
};

const channels = [
  { title: "Sales", body: "Volume pricing, enterprise SLAs, and procurement paperwork.", meta: "sales@zephiel.dev" },
  { title: "Support", body: "Integration questions and incidents. Priority routing on paid plans.", meta: "support@zephiel.dev" },
  { title: "Providers", body: "Listing an API on the marketplace.", meta: "partners@zephiel.dev" },
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
