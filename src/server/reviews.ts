import "server-only";
import { sql } from "@/lib/db";

export type Review = {
  id: string;
  rating: number;
  title: string;
  body: string;
  role: string;
  authorName: string;
  createdAt: Date;
};

export type ReviewSummary = {
  count: number;
  average: number;
  /** Share of reviews at each star, 5 down to 1, as whole percentages. */
  distribution: { stars: number; count: number; percent: number }[];
};

export async function getReviews(apiId: string, limit = 6): Promise<Review[]> {
  return sql<Review[]>`
    SELECT r.id, r.rating, r.title, r.body, r.role,
           u.name AS "authorName", r.created_at AS "createdAt"
    FROM reviews r
    JOIN users u ON u.id = r.user_id
    WHERE r.api_id = ${apiId}
    ORDER BY r.created_at DESC
    LIMIT ${limit}
  `;
}

/**
 * The rating and its distribution, both derived from the same rows.
 *
 * Previously the average came from a column and the histogram was a hardcoded
 * array, so a listing could show 4.4 stars above a distribution that averaged
 * 4.7. Computing both here makes that impossible.
 */
export async function getReviewSummary(apiId: string): Promise<ReviewSummary> {
  const rows = await sql<{ rating: number; count: string }[]>`
    SELECT rating, COUNT(*)::text AS count
    FROM reviews WHERE api_id = ${apiId}
    GROUP BY rating
  `;

  const byStar = new Map(rows.map((r) => [r.rating, Number(r.count)]));
  const count = [...byStar.values()].reduce((a, b) => a + b, 0);

  const total = [...byStar.entries()].reduce((sum, [stars, n]) => sum + stars * n, 0);
  const average = count === 0 ? 0 : total / count;

  const distribution = [5, 4, 3, 2, 1].map((stars) => {
    const n = byStar.get(stars) ?? 0;
    return { stars, count: n, percent: count === 0 ? 0 : Math.round((n / count) * 100) };
  });

  return { count, average: Math.round(average * 10) / 10, distribution };
}

/** Whether this customer may review — an active subscription is the proof. */
export async function canReview(userId: string, apiId: string) {
  const [row] = await sql<{ ok: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM subscriptions
      WHERE user_id = ${userId} AND api_id = ${apiId} AND status IN ('active','cancelled','expired')
    ) AS ok
  `;
  return row?.ok ?? false;
}

export async function getOwnReview(userId: string, apiId: string) {
  const [row] = await sql<{ id: string; rating: number; title: string; body: string; role: string }[]>`
    SELECT id, rating, title, body, role FROM reviews
    WHERE user_id = ${userId} AND api_id = ${apiId} LIMIT 1
  `;
  return row ?? null;
}

/**
 * Recompute the listing's stored rating and review count from its reviews, so
 * the catalog card and the detail page agree with what people actually wrote.
 */
export async function refreshApiRating(apiId: string) {
  await sql`
    UPDATE apis a SET
      rating  = COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews r WHERE r.api_id = a.id), 5.0),
      reviews = (SELECT COUNT(*) FROM reviews r WHERE r.api_id = a.id)
    WHERE a.id = ${apiId}
  `;
}
