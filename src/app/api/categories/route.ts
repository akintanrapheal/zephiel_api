import { NextResponse } from "next/server";
import { getCategories, getCategoryCounts } from "@/server/catalog";

export const dynamic = "force-dynamic";

/** GET /api/categories — categories with listing counts. */
export async function GET() {
  const [categories, counts] = await Promise.all([getCategories(), getCategoryCounts()]);

  return NextResponse.json({
    success: true,
    count: categories.length,
    data: categories.map((c) => ({
      slug: c.slug,
      name: c.name,
      blurb: c.blurb,
      api_count: counts[c.slug] ?? 0,
      url: `/categories/${c.slug}`,
    })),
  });
}
