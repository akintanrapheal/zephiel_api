import "server-only";
import { randomBytes } from "node:crypto";
import { sql } from "@/lib/db";
import { apis } from "@/data/apis";
import { categories } from "@/data/categories";
import { posts as seedPosts } from "@/data/posts";
import { reviewers, reviewBodies, multistoreReviews } from "@/data/reviews";

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

/** Ratings for `n` reviewers whose mean is as close to `target` as possible. */
function ratingsFor(target: number, n: number) {
  const wanted = Math.round(target * n);
  const base = Math.floor(wanted / n);
  let remainder = wanted - base * n;

  return Array.from({ length: n }, () => {
    const bump = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder -= 1;
    return Math.min(5, Math.max(1, base + bump));
  });
}

/**
 * Load the catalogue from src/data into the database.
 *
 * Shared by `npm run db:seed` and the admin console, so there is one
 * implementation rather than two that drift. Idempotent: content is upserted
 * by slug. Plans, endpoints, and seeded reviews are owned by the data files
 * and replaced; accounts, subscriptions, payments, keys, and usage are never
 * touched.
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

    await sql`DELETE FROM plans WHERE api_id = ${api.id}`;
    for (const [i, p] of a.plans.entries()) {
      await sql`
        INSERT INTO plans (api_id, name, price, unit, requests, rate_limit, features, popular, quota, sort_order)
        VALUES (${api.id}, ${p.name}, ${p.price}, ${p.unit ?? null}, ${p.requests},
                ${p.rateLimit}, ${p.features}, ${p.popular ?? false},
                ${quotaFor(p.requests)}, ${i})
      `;
      result.plans += 1;
    }

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

  // Reviewer accounts exist only to attribute the standard review set.
  const reviewerIds: string[] = [];
  for (const r of reviewers) {
    const [row] = await sql<{ id: string }[]>`
      INSERT INTO users (email, name, password_hash, role)
      VALUES (${r.email}, ${r.name}, ${`scrypt:${randomBytes(16).toString("hex")}:${randomBytes(64).toString("hex")}`}, 'customer')
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `;
    reviewerIds.push(row.id);
  }

  const [ms] = await sql<{ id: string }[]>`SELECT id FROM apis WHERE slug = 'multistore' LIMIT 1`;
  if (ms) {
    // Replace only the seeded set; anything a customer wrote is left alone.
    await sql`DELETE FROM reviews WHERE api_id = ${ms.id} AND user_id IS NULL`;

    for (const [i, r] of multistoreReviews.entries()) {
      await sql`
        INSERT INTO reviews (api_id, user_id, rating, author_name, role, title, body, created_at)
        VALUES (${ms.id}, NULL, ${r.rating}, ${r.name}, ${r.role}, '', ${r.body},
                now() - (${i * 4}::text || ' days')::interval)
      `;
      count += 1;
    }
  }

  for (const a of apis) {
    const [row] = await sql<{ id: string }[]>`SELECT id FROM apis WHERE slug = ${a.slug} LIMIT 1`;
    if (!row) continue;

    const ratings = ratingsFor(a.rating, reviewers.length);
    for (const [i, reviewerId] of reviewerIds.entries()) {
      await sql`
        INSERT INTO reviews (api_id, user_id, rating, title, body, role)
        VALUES (${row.id}, ${reviewerId}, ${ratings[i]}, ${reviewBodies[i].title},
                ${reviewBodies[i].body}, ${reviewers[i].role})
        ON CONFLICT (api_id, user_id) DO UPDATE
          SET rating = EXCLUDED.rating, title = EXCLUDED.title, body = EXCLUDED.body
      `;
      count += 1;
    }

    // Rating and count derive from the rows just written.
    await sql`
      UPDATE apis SET
        rating  = COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE api_id = ${row.id}), 5.0),
        reviews = (SELECT COUNT(*) FROM reviews WHERE api_id = ${row.id})
      WHERE id = ${row.id}
    `;
  }

  return count;
}

async function seedBlogPosts() {
  let count = 0;

  for (const [i, post] of seedPosts.entries()) {
    await sql`
      INSERT INTO posts (slug, title, excerpt, body, tag, read_minutes, published, published_at)
      VALUES (${post.slug}, ${post.title}, ${post.excerpt}, ${post.body}, ${post.tag},
              ${post.readMinutes}, true, now() - (${i * 11}::text || ' days')::interval)
      ON CONFLICT (slug) DO UPDATE
        SET title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, body = EXCLUDED.body,
            tag = EXCLUDED.tag, read_minutes = EXCLUDED.read_minutes, updated_at = now()
    `;
    count += 1;
  }

  return count;
}
