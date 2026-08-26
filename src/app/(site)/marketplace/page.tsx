import type { Metadata } from "next";
import { getApis, getCategories } from "@/server/catalog";
import Catalog from "@/components/Catalog";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Marketplace",
  description: "Browse and filter every API on Zephiel by category, rating, latency, and free tier.",
};

export default async function MarketplacePage() {
  const [apis, categories] = await Promise.all([getApis(), getCategories()]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">API Marketplace</h1>
        <p className="mt-3 text-[15px] leading-7 text-muted">
          Every API here is monitored, versioned, and billed through your single Zephiel key. Filter by what
          you need, test the response shape, then subscribe without leaving the page.
        </p>
      </header>

      <div className="mt-10">
        <Catalog apis={apis} categories={categories} />
      </div>
    </div>
  );
}
