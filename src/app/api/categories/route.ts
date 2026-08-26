import { NextResponse } from "next/server";
import { categories } from "@/data/categories";
import { apis } from "@/data/apis";

/** GET /api/categories — categories with listing counts. */
export function GET() {
  return NextResponse.json({
    success: true,
    count: categories.length,
    data: categories.map((c) => ({
      slug: c.slug,
      name: c.name,
      blurb: c.blurb,
      api_count: apis.filter((a) => a.category === c.slug).length,
      url: `/categories/${c.slug}`,
    })),
  });
}
