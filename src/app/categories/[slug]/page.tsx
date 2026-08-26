import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { categories, categoryBySlug } from "@/data/categories";
import { apisByCategory } from "@/data/apis";
import Catalog from "@/components/Catalog";

export function generateStaticParams() {
  return categories.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const cat = categoryBySlug(slug);
  if (!cat) return { title: "Category not found" };
  return { title: cat.name, description: cat.blurb };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cat = categoryBySlug(slug);
  if (!cat) notFound();

  const list = apisByCategory(slug);

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <nav className="flex items-center gap-2 text-sm text-muted">
        <Link href="/categories" className="transition hover:text-ink">
          Categories
        </Link>
        <span aria-hidden>/</span>
        <span className="text-ink">{cat.name}</span>
      </nav>

      <header className="mt-6 flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-6 w-6">
            <path d={cat.icon} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">{cat.name}</h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-7 text-muted">{cat.blurb}</p>
        </div>
      </header>

      <div className="mt-10">
        <Catalog apis={list} initialCategory={slug} lockCategory />
      </div>

      <section className="mt-16 border-t border-line pt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink">Other categories</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {categories
            .filter((c) => c.slug !== slug)
            .map((c) => (
              <Link
                key={c.slug}
                href={`/categories/${c.slug}`}
                className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm text-muted transition hover:border-brand-300 hover:text-ink"
              >
                {c.name}
              </Link>
            ))}
        </div>
      </section>
    </div>
  );
}
