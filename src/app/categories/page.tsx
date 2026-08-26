import type { Metadata } from "next";
import Link from "next/link";
import { categories } from "@/data/categories";
import { apis } from "@/data/apis";

export const metadata: Metadata = {
  title: "Categories",
  description: "Explore Zephiel APIs grouped by category — finance, geo, AI, weather, media, security, and more.",
};

export default function CategoriesPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Categories</h1>
        <p className="mt-3 text-[15px] leading-7 text-muted">
          Eight families of APIs covering the integrations most teams reach for first.
        </p>
      </header>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c) => {
          const list = apis.filter((a) => a.category === c.slug);
          return (
            <Link
              key={c.slug}
              href={`/categories/${c.slug}`}
              className="group rounded-2xl border border-line bg-surface p-6 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lift"
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-500/10 text-brand-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5">
                  <path d={c.icon} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <h2 className="mt-4 text-base font-semibold tracking-tight text-ink">{c.name}</h2>
              <p className="mt-1.5 text-sm leading-6 text-muted">{c.blurb}</p>

              <ul className="mt-4 space-y-1.5 border-t border-line pt-4">
                {list.slice(0, 3).map((a) => (
                  <li key={a.slug} className="truncate text-xs text-muted">
                    {a.name}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs font-semibold text-brand-600">
                {list.length} {list.length === 1 ? "API" : "APIs"} &rarr;
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
