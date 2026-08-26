import { NextResponse } from "next/server";
import { apis } from "@/data/apis";

/**
 * GET /api/apis?category=finance&q=currency&free=true&limit=10
 * Public JSON view of the catalog — the same data the marketplace pages render.
 */
export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const q = searchParams.get("q")?.trim().toLowerCase();
  const free = searchParams.get("free") === "true";
  const limitParam = Number(searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : undefined;

  let results = apis.filter((a) => {
    if (category && a.category !== category) return false;
    if (free && !a.freeTier) return false;
    if (!q) return true;
    return (
      a.name.toLowerCase().includes(q) ||
      a.tagline.toLowerCase().includes(q) ||
      a.tags.some((t) => t.includes(q))
    );
  });

  if (limit) results = results.slice(0, limit);

  return NextResponse.json({
    success: true,
    count: results.length,
    data: results.map((a) => ({
      slug: a.slug,
      name: a.name,
      tagline: a.tagline,
      category: a.category,
      provider: a.provider,
      rating: a.rating,
      subscribers: a.subscribers,
      latency_ms: a.latency,
      uptime: a.uptime,
      free_tier: a.freeTier,
      tags: a.tags,
      starts_at: a.plans.find((p) => p.price > 0)?.price ?? 0,
      url: `/marketplace/${a.slug}`,
    })),
  });
}
