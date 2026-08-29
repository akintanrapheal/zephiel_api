import "server-only";
import { sql } from "@/lib/db";
import { apis } from "@/data/apis";
import { categories } from "@/data/categories";
import { posts as seedPosts } from "@/data/posts";
import { reviewsForApi, multistoreReviews, legacyReviewerEmails } from "@/data/reviews";

export type SeedResult = {
  categories: number;
  apis: number;
  plans: number;
  endpoints: number;
  reviews: number;
  posts: number;
};

/** Monthly allowance implied by a plan's own label. */
function quotaFor(requests: string) {
  if (/unlimited/i.test(requests)) return 10_000_000;
  const nums = requests.replace(/,/g, "").match(/\d+/g);
  return nums ? Math.max(...nums.map(Number)) : 100;
}

/**
 * Load the catalogue from src/data into the database.
 *
 * Shared by `npm run db:seed` and the admin console, so there is one
 * implementation rather than two that drift. Idempotent: content is upserted
 * by slug, and plans by (api_id, name).
 *
 * Accounts, subscriptions, payments, keys, stores, and usage are never
 * touched. Plans in particular are upserted rather than replaced: they were
 * deleted and reinserted until August 2026, and because subscriptions.plan_id
 * cascades, every reseed silently wiped every customer's subscription, their
 * stores, and their per-store keys.
 */
export async function seedCatalogue(): Promise<SeedResult> {
  const result: SeedResult = {
    categories: 0,
    apis: 0,
    plans: 0,
    endpoints: 0,
    reviews: 0,
    posts: 0,
  };

  for (const [i, c] of categories.entries()) {
    await sql`
      INSERT INTO categories (slug, name, blurb, icon, sort_order)
      VALUES (${c.slug}, ${c.name}, ${c.blurb}, ${c.icon}, ${i})
      ON CONFLICT (slug) DO UPDATE
        SET name = EXCLUDED.name, blurb = EXCLUDED.blurb,
            icon = EXCLUDED.icon, sort_order = EXCLUDED.sort_order
    `;
    result.categories += 1;
  }

  for (const a of apis) {
    const [cat] = await sql<{ id: string }[]>`
      SELECT id FROM categories WHERE slug = ${a.category} LIMIT 1
    `;

    const [api] = await sql<{ id: string }[]>`
      INSERT INTO apis (
        slug, name, tagline, description, category_id, provider, logo, icon, color,
        rating, reviews, subscribers, latency, uptime, featured, free_tier,
        published, tags, use_cases, sample_response
      ) VALUES (
        ${a.slug}, ${a.name}, ${a.tagline}, ${a.description}, ${cat?.id ?? null},
        ${a.provider}, ${a.logo}, ${a.icon ?? ""}, ${a.color}, ${a.rating}, ${a.reviews},
        ${a.subscribers}, ${a.latency}, ${a.uptime}, ${a.featured ?? false},
        ${a.freeTier}, true, ${a.tags}, ${a.useCases}, ${a.sampleResponse}
      )
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name, tagline = EXCLUDED.tagline,
        description = EXCLUDED.description, category_id = EXCLUDED.category_id,
        provider = EXCLUDED.provider, logo = EXCLUDED.logo, icon = EXCLUDED.icon,
        color = EXCLUDED.color, subscribers = EXCLUDED.subscribers,
        latency = EXCLUDED.latency, uptime = EXCLUDED.uptime,
        featured = EXCLUDED.featured, free_tier = EXCLUDED.free_tier,
        tags = EXCLUDED.tags, use_cases = EXCLUDED.use_cases,
        sample_response = EXCLUDED.sample_response, updated_at = now()
      RETURNING id
    `;
    result.apis += 1;

    // Upserted, never replaced: subscriptions.plan_id cascades, so deleting a
    // plan would delete every subscription on it along with that customer's
    // stores and per-store keys.
    for (const [i, p] of a.plans.entries()) {
      await sql`
        INSERT INTO plans (api_id, name, price, unit, requests, rate_limit, features, popular, quota, sort_order)
        VALUES (${api.id}, ${p.name}, ${p.price}, ${p.unit ?? null}, ${p.requests},
                ${p.rateLimit}, ${p.features}, ${p.popular ?? false},
                ${quotaFor(p.requests)}, ${i})
        ON CONFLICT (api_id, name) DO UPDATE SET
          price = EXCLUDED.price, unit = EXCLUDED.unit, requests = EXCLUDED.requests,
          rate_limit = EXCLUDED.rate_limit, features = EXCLUDED.features,
          popular = EXCLUDED.popular, quota = EXCLUDED.quota, sort_order = EXCLUDED.sort_order
      `;
      result.plans += 1;
    }

    // A plan dropped from the data file goes only if nobody is on it. One that
    // still has subscribers stays until those are moved.
    await sql`
      DELETE FROM plans
      WHERE api_id = ${api.id}
        AND name <> ALL(${a.plans.map((p) => p.name)})
        AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.plan_id = plans.id)
    `;

    await sql`DELETE FROM endpoints WHERE api_id = ${api.id}`;
    for (const [i, e] of a.endpoints.entries()) {
      await sql`
        INSERT INTO endpoints (api_id, method, path, summary, sort_order)
        VALUES (${api.id}, ${e.method}, ${e.path}, ${e.summary}, ${i})
      `;
      result.endpoints += 1;
    }
  }

  result.reviews = await seedReviews();
  result.posts = await seedBlogPosts();

  return result;
}

async function seedReviews() {
  let count = 0;

  // The reviews these accounts carried repeated the same five bodies on every
  // listing. Removing the accounts removes those rows with them.
  await sql`DELETE FROM users WHERE email = ANY(${legacyReviewerEmails}) AND role = 'customer'`;

  const [ms] = await sql<{ id: string }[]>`SELECT id FROM apis WHERE slug = 'multistore' LIMIT 1`;
  if (ms) {
    // Replace only the seeded set; anything a customer wrote is left alone.
    await sql`DELETE FROM reviews WHERE api_id = ${ms.id} AND user_id IS NULL`;
    for (const [i, r] of multistoreReviews.entries()) {
      await sql`
        INSERT INTO reviews (api_id, user_id, rating, author_name, role, title, body, created_at)
        VALUES (${ms.id}, NULL, ${r.rating}, ${r.name}, ${r.role}, ${r.title ?? ""}, ${r.body},
                now() - (${i * 4}::text || ' days')::interval)
      `;
      count += 1;
    }
  }

  for (const a of apis) {
    const [row] = await sql<{ id: string }[]>`SELECT id FROM apis WHERE slug = ${a.slug} LIMIT 1`;
    if (!row) continue;
    if (a.slug === "multistore") {
      await refreshRating(row.id);
      continue;
    }

    await sql`DELETE FROM reviews WHERE api_id = ${row.id} AND user_id IS NULL`;

    for (const [i, r] of reviewsForApi(a).entries()) {
      await sql`
        INSERT INTO reviews (api_id, user_id, rating, author_name, role, title, body, created_at)
        VALUES (${row.id}, NULL, ${r.rating}, ${r.name}, ${r.role}, ${r.title ?? ""}, ${r.body},
                now() - (${i * 9 + 2}::text || ' days')::interval)
      `;
      count += 1;
    }

    await refreshRating(row.id);
  }

  return count;
}

/** Rating and count derive from the rows, so the two can never disagree. */
async function refreshRating(apiId: string) {
  await sql`
    UPDATE apis SET
      rating  = COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE api_id = ${apiId}), 5.0),
      reviews = (SELECT COUNT(*) FROM reviews WHERE api_id = ${apiId})
    WHERE id = ${apiId}
  `;
}

async function seedBlogPosts() {
  let count = 0;

  for (const post of seedPosts) {
    await sql`
      INSERT INTO posts (slug, title, excerpt, body, tag, read_minutes, published, published_at)
      VALUES (${post.slug}, ${post.title}, ${post.excerpt}, ${post.body}, ${post.tag},
              ${post.readMinutes}, true, ${post.publishedAt}::date)
      ON CONFLICT (slug) DO UPDATE
        SET title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, body = EXCLUDED.body,
            tag = EXCLUDED.tag, read_minutes = EXCLUDED.read_minutes,
            published_at = EXCLUDED.published_at, updated_at = now()
    `;
    count += 1;
  }

  return count;
}
