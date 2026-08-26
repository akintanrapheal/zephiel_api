import "server-only";
import { sql } from "@/lib/db";
import type { Api, Category, Endpoint, Plan } from "@/lib/types";

type ApiRow = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: string | null;
  provider: string;
  logo: string;
  color: string;
  rating: string;
  reviews: number;
  subscribers: number;
  latency: number;
  uptime: string;
  featured: boolean;
  free_tier: boolean;
  published: boolean;
  tags: string[];
  use_cases: string[];
  sample_response: string;
  plans: Plan[] | null;
  endpoints: Endpoint[] | null;
};

function toApi(r: ApiRow): Api {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    tagline: r.tagline,
    description: r.description,
    category: r.category ?? "",
    provider: r.provider,
    logo: r.logo,
    color: r.color,
    rating: Number(r.rating),
    reviews: r.reviews,
    subscribers: r.subscribers,
    latency: r.latency,
    uptime: Number(r.uptime),
    featured: r.featured,
    freeTier: r.free_tier,
    published: r.published,
    tags: r.tags ?? [],
    useCases: r.use_cases ?? [],
    sampleResponse: r.sample_response,
    plans: (r.plans ?? []).map((p) => ({
      ...p,
      price: Number(p.price),
      unit: p.unit ?? undefined,
      features: p.features ?? [],
    })),
    endpoints: r.endpoints ?? [],
  };
}

/**
 * Plans and endpoints are aggregated in the query so listing the catalog stays
 * a single round trip rather than one query per API.
 */
const apiSelect = sql`
  SELECT
    a.id, a.slug, a.name, a.tagline, a.description,
    c.slug AS category,
    a.provider, a.logo, a.color, a.rating, a.reviews, a.subscribers,
    a.latency, a.uptime, a.featured, a.free_tier, a.published,
    a.tags, a.use_cases, a.sample_response,
    COALESCE((
      SELECT json_agg(json_build_object(
        'id', p.id, 'name', p.name, 'price', p.price, 'unit', p.unit,
        'requests', p.requests, 'rateLimit', p.rate_limit,
        'features', p.features, 'popular', p.popular, 'quota', p.quota
      ) ORDER BY p.sort_order)
      FROM plans p WHERE p.api_id = a.id
    ), '[]'::json) AS plans,
    COALESCE((
      SELECT json_agg(json_build_object(
        'id', e.id, 'method', e.method, 'path', e.path, 'summary', e.summary
      ) ORDER BY e.sort_order)
      FROM endpoints e WHERE e.api_id = a.id
    ), '[]'::json) AS endpoints
  FROM apis a
  LEFT JOIN categories c ON c.id = a.category_id
`;

export async function getApis({ includeUnpublished = false } = {}): Promise<Api[]> {
  const rows = await sql<ApiRow[]>`
    ${apiSelect}
    ${includeUnpublished ? sql`` : sql`WHERE a.published = true`}
    ORDER BY a.subscribers DESC, a.name ASC
  `;
  return rows.map(toApi);
}

export async function getApiBySlug(slug: string, { includeUnpublished = false } = {}) {
  const rows = await sql<ApiRow[]>`
    ${apiSelect}
    WHERE a.slug = ${slug}
    ${includeUnpublished ? sql`` : sql`AND a.published = true`}
    LIMIT 1
  `;
  return rows[0] ? toApi(rows[0]) : null;
}

export async function getApiById(id: string) {
  const rows = await sql<ApiRow[]>`${apiSelect} WHERE a.id = ${id} LIMIT 1`;
  return rows[0] ? toApi(rows[0]) : null;
}

export async function getCategories(): Promise<Category[]> {
  const rows = await sql<
    { id: string; slug: string; name: string; blurb: string; icon: string }[]
  >`SELECT id, slug, name, blurb, icon FROM categories ORDER BY sort_order, name`;
  return rows;
}

export async function getCategoryBySlug(slug: string) {
  const rows = await sql<
    { id: string; slug: string; name: string; blurb: string; icon: string }[]
  >`SELECT id, slug, name, blurb, icon FROM categories WHERE slug = ${slug} LIMIT 1`;
  return rows[0] ?? null;
}

export async function getApisByCategory(slug: string): Promise<Api[]> {
  const rows = await sql<ApiRow[]>`
    ${apiSelect}
    WHERE a.published = true AND c.slug = ${slug}
    ORDER BY a.subscribers DESC
  `;
  return rows.map(toApi);
}

export async function getFeaturedApis(): Promise<Api[]> {
  const rows = await sql<ApiRow[]>`
    ${apiSelect}
    WHERE a.published = true AND a.featured = true
    ORDER BY a.subscribers DESC
    LIMIT 4
  `;
  return rows.map(toApi);
}

export async function getCategoryCounts() {
  const rows = await sql<{ slug: string; count: string }[]>`
    SELECT c.slug, COUNT(a.id)::text AS count
    FROM categories c
    LEFT JOIN apis a ON a.category_id = c.id AND a.published = true
    GROUP BY c.slug
  `;
  return Object.fromEntries(rows.map((r) => [r.slug, Number(r.count)]));
}

export async function countApis() {
  const [row] = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count FROM apis WHERE published = true
  `;
  return Number(row?.count ?? 0);
}
