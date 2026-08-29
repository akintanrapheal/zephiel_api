/*
 * Loads the catalogue and creates the first administrator.
 *
 * The content comes from the same src/data files the admin console reads, so
 * "Reseed catalogue" in the console and this command produce identical
 * results. Creating an administrator stays here: it is a one-time bootstrap,
 * and the console cannot be reached before it has happened.
 */
import { randomBytes, scrypt as _scrypt } from "node:crypto";
import { promisify } from "node:util";
import postgres from "postgres";
import { loadEnv } from "./env.mts";
import { apis } from "../src/data/apis.ts";
import { categories } from "../src/data/categories.ts";
import { posts } from "../src/data/posts.ts";
import { reviewsForApi, multistoreReviews, legacyReviewerEmails } from "../src/data/reviews.ts";

loadEnv();

const scrypt = promisify(_scrypt) as (p: string, s: string, k: number) => Promise<Buffer>;

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${key.toString("hex")}`;
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Add it to .env.local (see .env.example).");
  process.exit(1);
}

const sql = postgres(url, {
  max: 1,
  ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : "require",
  onnotice: () => {},
});

function quotaFor(requests: string) {
  if (/unlimited/i.test(requests)) return 10_000_000;
  const nums = requests.replace(/,/g, "").match(/\d+/g);
  return nums ? Math.max(...nums.map(Number)) : 100;
}

try {
  console.log(`Seeding ${categories.length} categories...`);
  for (const [i, c] of categories.entries()) {
    await sql`
      INSERT INTO categories (slug, name, blurb, icon, sort_order)
      VALUES (${c.slug}, ${c.name}, ${c.blurb}, ${c.icon}, ${i})
      ON CONFLICT (slug) DO UPDATE
        SET name = EXCLUDED.name, blurb = EXCLUDED.blurb,
            icon = EXCLUDED.icon, sort_order = EXCLUDED.sort_order
    `;
  }

  console.log(`Seeding ${apis.length} APIs...`);
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
    }
  }

  console.log("Seeding reviews...");
  let reviewCount = 0;

  // Retire the placeholder accounts an earlier seeder used to attribute a
  // shared review set; the cascade on reviews.user_id takes their rows too.
  // Never take an account that has real activity: these addresses only ever
  // belonged to seed placeholders, but deleting a user cascades to their
  // subscriptions, stores, and keys, so the guard is worth the line.
  await sql`
    DELETE FROM users u
    WHERE u.email = ANY(${legacyReviewerEmails}) AND u.role = 'customer'
      AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id = u.id)
      AND NOT EXISTS (SELECT 1 FROM stores st WHERE st.user_id = u.id)
  `;

  const [ms] = await sql<{ id: string }[]>`SELECT id FROM apis WHERE slug = 'multistore' LIMIT 1`;
  if (ms) {
    await sql`DELETE FROM reviews WHERE api_id = ${ms.id} AND user_id IS NULL`;
    for (const [i, r] of multistoreReviews.entries()) {
      await sql`
        INSERT INTO reviews (api_id, user_id, rating, author_name, role, title, body, created_at)
        VALUES (${ms.id}, NULL, ${r.rating}, ${r.name}, ${r.role}, ${r.title ?? ""}, ${r.body},
                now() - (${i * 4}::text || ' days')::interval)
      `;
      reviewCount += 1;
    }
  }

  for (const a of apis) {
    const [row] = await sql<{ id: string }[]>`SELECT id FROM apis WHERE slug = ${a.slug} LIMIT 1`;
    if (!row) continue;

    if (a.slug !== "multistore") {
      await sql`DELETE FROM reviews WHERE api_id = ${row.id} AND user_id IS NULL`;
      for (const [i, r] of reviewsForApi(a).entries()) {
        await sql`
          INSERT INTO reviews (api_id, user_id, rating, author_name, role, title, body, created_at)
          VALUES (${row.id}, NULL, ${r.rating}, ${r.name}, ${r.role}, ${r.title ?? ""}, ${r.body},
                  now() - (${i * 9 + 2}::text || ' days')::interval)
        `;
        reviewCount += 1;
      }
    }

    await sql`
      UPDATE apis SET
        rating  = COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE api_id = ${row.id}), 5.0),
        reviews = (SELECT COUNT(*) FROM reviews WHERE api_id = ${row.id})
      WHERE id = ${row.id}
    `;
  }
  console.log(`  ${reviewCount} reviews written`);

  console.log(`Seeding ${posts.length} posts...`);
  for (const post of posts) {
    await sql`
      INSERT INTO posts (slug, title, excerpt, body, tag, read_minutes, published, published_at)
      VALUES (${post.slug}, ${post.title}, ${post.excerpt}, ${post.body}, ${post.tag},
              ${post.readMinutes}, true, ${post.publishedAt}::date)
      ON CONFLICT (slug) DO UPDATE
        SET title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, body = EXCLUDED.body,
            tag = EXCLUDED.tag, read_minutes = EXCLUDED.read_minutes,
            published_at = EXCLUDED.published_at, updated_at = now()
    `;
  }

  // --- administrator bootstrap ---------------------------------------------
  const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@zephiel.com").toLowerCase();
  const generated = !process.env.ADMIN_PASSWORD;
  const adminPassword = process.env.ADMIN_PASSWORD ?? randomBytes(12).toString("base64url");

  // The project moved from zephiel.dev to zephiel.com; rename the existing
  // administrator rather than leaving a second account behind.
  if (adminEmail.endsWith("@zephiel.com")) {
    const legacy = adminEmail.replace(/@zephiel\.com$/, "@zephiel.dev");
    await sql`
      UPDATE users SET email = ${adminEmail} WHERE email = ${legacy} AND role = 'admin'
        AND NOT EXISTS (SELECT 1 FROM users u2 WHERE u2.email = ${adminEmail})
    `;
  }

  const [existing] = await sql<{ id: string }[]>`
    SELECT id FROM users WHERE email = ${adminEmail} LIMIT 1
  `;

  if (existing) {
    await sql`UPDATE users SET role = 'admin' WHERE id = ${existing.id}`;
    console.log(`\nAdmin already exists: ${adminEmail} (role confirmed)`);
  } else {
    await sql`
      INSERT INTO users (email, name, password_hash, role)
      VALUES (${adminEmail}, 'Administrator', ${await hashPassword(adminPassword)}, 'admin')
    `;
    console.log(`\nCreated admin: ${adminEmail}`);
    console.log(`Password:      ${adminPassword}`);
    if (generated) {
      console.log("\nThis password was generated and is shown only once — save it now.");
      console.log("Change it at /admin/settings, or with `npm run admin:password`.\n");
    }
  }

  console.log("Seed complete.");
} catch (err) {
  console.error("Seed failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
