/*
 * Seeds the catalog from src/data/*.ts and creates the first admin user.
 * Idempotent: upserts by slug, so re-running refreshes content without
 * duplicating rows or disturbing users, subscriptions, or payments.
 */
import { randomBytes, scrypt as _scrypt } from "node:crypto";
import { promisify } from "node:util";
import postgres from "postgres";
import { loadEnv } from "./env.mts";
import { apis } from "../src/data/apis.ts";
import { categories } from "../src/data/categories.ts";

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
});

/** Quota implied by a plan, used to seed subscription limits. */
function quotaFor(requests: string) {
  if (/unlimited/i.test(requests)) return 10_000_000;
  // "1 store, 1,000 calls/mo" — the call allowance is the largest number.
  const nums = requests.replace(/,/g, "").match(/\d+/g);
  return nums ? Math.max(...nums.map(Number)) : 100;
}

try {
  console.log("Seeding categories...");
  for (const [i, c] of categories.entries()) {
    await sql`
      INSERT INTO categories (slug, name, blurb, icon, sort_order)
      VALUES (${c.slug}, ${c.name}, ${c.blurb}, ${c.icon}, ${i})
      ON CONFLICT (slug) DO UPDATE
        SET name = EXCLUDED.name,
            blurb = EXCLUDED.blurb,
            icon = EXCLUDED.icon,
            sort_order = EXCLUDED.sort_order
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
        color = EXCLUDED.color,
        rating = EXCLUDED.rating, reviews = EXCLUDED.reviews,
        subscribers = EXCLUDED.subscribers, latency = EXCLUDED.latency,
        uptime = EXCLUDED.uptime, featured = EXCLUDED.featured,
        free_tier = EXCLUDED.free_tier, tags = EXCLUDED.tags,
        use_cases = EXCLUDED.use_cases, sample_response = EXCLUDED.sample_response,
        updated_at = now()
      RETURNING id
    `;

    // Plans and endpoints are fully owned by the seed file, so replace them.
    await sql`DELETE FROM plans WHERE api_id = ${api.id}`;
    for (const [i, p] of a.plans.entries()) {
      await sql`
        INSERT INTO plans (api_id, name, price, unit, requests, rate_limit, features, popular, quota, sort_order)
        VALUES (${api.id}, ${p.name}, ${p.price}, ${p.unit ?? null}, ${p.requests},
                ${p.rateLimit}, ${p.features}, ${p.popular ?? false},
                ${quotaFor(p.requests)}, ${i})
      `;
    }

    await sql`DELETE FROM endpoints WHERE api_id = ${api.id}`;
    for (const [i, e] of a.endpoints.entries()) {
      await sql`
        INSERT INTO endpoints (api_id, method, path, summary, sort_order)
        VALUES (${api.id}, ${e.method}, ${e.path}, ${e.summary}, ${i})
      `;
    }
  }

  const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@zephiel.dev").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD ?? "zephiel-admin";

  const [existing] = await sql<{ id: string }[]>`
    SELECT id FROM users WHERE email = ${adminEmail} LIMIT 1
  `;

  if (existing) {
    await sql`UPDATE users SET role = 'admin' WHERE id = ${existing.id}`;
    console.log(`Admin already exists: ${adminEmail} (role confirmed)`);
  } else {
    await sql`
      INSERT INTO users (email, name, password_hash, role)
      VALUES (${adminEmail}, 'Administrator', ${await hashPassword(adminPassword)}, 'admin')
    `;
    console.log(`Created admin: ${adminEmail} / ${adminPassword}`);
  }

  console.log("Seed complete.");
} catch (err) {
  console.error("Seed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
} finally {
  await sql.end();
}
