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

  // --- reviews -------------------------------------------------------------
  // Ratings shown on a listing are computed from these rows, so the seed has
  // to produce a set whose average is the intended rating rather than writing
  // a number and a contradicting review.
  const reviewers = [
    { email: "amara@zephiel.dev", name: "Amara Okonkwo", role: "Engineering Lead" },
    { email: "daniel@zephiel.dev", name: "Daniel Kessler", role: "CTO" },
    { email: "priya@zephiel.dev", name: "Priya Sundaram", role: "Staff Engineer" },
    { email: "tomas@zephiel.dev", name: "Tomas Ferreira", role: "Platform Engineer" },
    { email: "lin@zephiel.dev", name: "Lin Zhao", role: "Backend Developer" },
  ];

  const reviewerIds: string[] = [];
  for (const r of reviewers) {
    const [row] = await sql<{ id: string }[]>`
      INSERT INTO users (email, name, password_hash, role)
      VALUES (${r.email}, ${r.name}, ${await hashPassword(randomBytes(24).toString("hex"))}, 'customer')
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `;
    reviewerIds.push(row.id);
  }

  const bodies = [
    { title: "Consistent and quick to integrate",
      body: "Response shapes match the docs exactly, and the free tier covered the whole prototype before anyone had to approve a purchase order." },
    { title: "Replaced three vendors",
      body: "One key and one invoice instead of three of each. Support answered a rate-limit question the same afternoon." },
    { title: "Good, with room to grow",
      body: "Does what it says and the samples run unmodified. I would like deeper filtering on the batch endpoint." },
    { title: "Latency has held up",
      body: "Steady under a hundred milliseconds from eu-west for months, and the status page matched what we actually observed." },
    { title: "Solid, unglamorous, reliable",
      body: "It has not surprised us once in six months, which is the highest compliment I can pay a dependency." },
  ];

  /** Ratings for `n` reviewers whose mean is as close to `target` as possible. */
  function ratingsFor(target: number, n: number) {
    const totalWanted = Math.round(target * n);
    const base = Math.floor(totalWanted / n);
    let remainder = totalWanted - base * n;

    return Array.from({ length: n }, (_, i) => {
      const bump = remainder > 0 ? 1 : 0;
      if (remainder > 0) remainder -= 1;
      return Math.min(5, Math.max(1, base + bump - (i === n - 1 && base + bump > 5 ? 1 : 0)));
    });
  }

  // Multistore is the flagship listing, so it carries a full review history
  // rather than the handful every listing gets.
  const deepNames = [
    ["Chidi Nwosu", "Head of Engineering"], ["Sarah Whitfield", "Founder"],
    ["Marcus Adeyemi", "Lead Developer"], ["Elena Rossi", "Product Manager"],
    ["Kwame Boateng", "Integrations Lead"], ["Yuki Tanaka", "Backend Engineer"],
    ["Fatima Bello", "Operations Director"], ["James O'Connor", "CTO"],
    ["Ngozi Eze", "Ecommerce Manager"], ["Ravi Menon", "Solutions Architect"],
    ["Hannah Lindqvist", "Platform Lead"], ["Tunde Alabi", "Technical Director"],
    ["Grace Mwangi", "Head of Retail Tech"], ["Pieter de Vries", "Staff Engineer"],
    ["Aisha Suleiman", "Digital Lead"], ["Carlos Mendez", "Engineering Manager"],
    ["Blessing Okafor", "Systems Analyst"], ["Sofia Almeida", "Developer"],
    ["Ibrahim Diallo", "Head of Product"], ["Mei Chen", "Integration Engineer"],
    ["Olamide Fashola", "Retail Systems Lead"], ["Anna Kowalski", "Senior Developer"],
    ["Emeka Obi", "Technical Lead"], ["Laura Bennett", "Director of Engineering"],
  ];

  const deepBodies = [
    "We run seven storefronts across three platforms. Before this, inventory drifted between them constantly and someone reconciled it by hand every Monday. That job no longer exists.",
    "The per-store key model is what sold it. When a contractor left we rotated one key instead of auditing every integration we had ever built.",
    "Pushing a price change to every channel used to be four separate admin logins. It is one call now, and it lands in seconds.",
    "Overselling was our biggest support cost. Continuous reconciliation cut it to almost nothing within a fortnight of switching over.",
    "The unified order queue is the part I did not expect to care about. Our fulfilment team works one list instead of tabbing between platforms.",
    "Setup took an afternoon. The connectors handled the field mapping quirks between Shopify and WooCommerce that I had budgeted a week for.",
    "Billing per store is honest and predictable. We add a market, we pay for a market, and the invoice matches what I expected.",
    "Migrating a store between platforms would have been a month of work. We ran both in parallel through the same API and cut over quietly.",
    "Documentation is accurate, which sounds like a low bar until you have integrated something where it is not.",
    "Latency has been steady even during our Black Friday peak, when both upstream platforms were visibly struggling.",
    "The sandbox status on a store is genuinely useful — we stage catalogue changes without touching live inventory.",
    "Support answered a webhook ordering question in under two hours with an actual explanation rather than a link to the FAQ.",
    "We had a stock sync bug on our side and the per-store call charts made it obvious within minutes which storefront was misbehaving.",
    "Nine stores, one integration, one invoice. The finance team stopped asking me what half the line items were.",
    "Would like richer conflict resolution when two platforms disagree about a product, but the field mapping covers most of it.",
    "The API returns the same shapes regardless of which platform is behind it. That consistency is the whole value.",
    "Disconnecting a seasonal store and reconnecting it three months later kept its history intact. Small thing, saved a reconciliation.",
    "Our Etsy and Amazon listings finally match the main catalogue without a nightly script nobody wanted to maintain.",
    "Rate limits are generous enough that our hourly full sync never comes close to them.",
    "It does one thing and does it properly. I have no complaints after eight months in production.",
    "Onboarding a new franchise store is now a form rather than a project.",
    "The order webhooks are reliable enough that we retired our polling job entirely.",
    "Catalogue push handled forty thousand SKUs without complaint. I expected to have to batch it myself.",
    "Honestly the best integration decision we made last year.",
  ];

  const [msRow] = await sql<{ id: string }[]>`SELECT id FROM apis WHERE slug = 'multistore' LIMIT 1`;
  if (msRow) {
    console.log("Seeding multistore reviews...");
    await sql`DELETE FROM reviews WHERE api_id = ${msRow.id} AND user_id IS NULL`;

    for (const [i, [name, role]] of deepNames.entries()) {
      // Weighted to land on a high average without being uniformly perfect.
      const rating = i % 9 === 0 ? 4 : i % 17 === 0 ? 3 : 5;
      await sql`
        INSERT INTO reviews (api_id, user_id, rating, author_name, role, title, body, created_at)
        VALUES (${msRow.id}, NULL, ${rating}, ${name}, ${role}, '',
                ${deepBodies[i % deepBodies.length]},
                now() - (${i * 4}::text || ' days')::interval)
      `;
    }
  }

  console.log("Seeding reviews...");
  for (const a of apis) {
    const [row] = await sql<{ id: string }[]>`SELECT id FROM apis WHERE slug = ${a.slug} LIMIT 1`;
    if (!row) continue;

    const ratings = ratingsFor(a.rating, reviewers.length);

    for (const [i, reviewerId] of reviewerIds.entries()) {
      await sql`
        INSERT INTO reviews (api_id, user_id, rating, title, body, role)
        VALUES (${row.id}, ${reviewerId}, ${ratings[i]}, ${bodies[i].title},
                ${bodies[i].body}, ${reviewers[i].role})
        ON CONFLICT (api_id, user_id) DO UPDATE
          SET rating = EXCLUDED.rating, title = EXCLUDED.title, body = EXCLUDED.body
      `;
    }

    // Rating and count now derive from the rows just written.
    await sql`
      UPDATE apis SET
        rating  = (SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE api_id = ${row.id}),
        reviews = (SELECT COUNT(*) FROM reviews WHERE api_id = ${row.id})
      WHERE id = ${row.id}
    `;
  }

  // --- posts ---------------------------------------------------------------
  console.log("Seeding posts...");
  const posts = [
    {
      slug: "why-we-publish-p99",
      title: "Why we publish our p99, not our p50",
      tag: "Engineering",
      readMinutes: 6,
      excerpt:
        "Median latency is a marketing number. The tail is what pages your on-call. Here is every percentile we measure and how we collect it.",
      body: `Every vendor page quotes a median. It is the most flattering number available, and it tells you almost nothing about the experience of running something in production.

## The median hides the failure

If half your calls return in 40ms and one in a hundred takes four seconds, the median still reads 40ms. Your users experience the four seconds. Your on-call engineer is paged about the four seconds. Nobody has ever been woken up by a p50.

## What we measure

Latency is recorded at the gateway for every call, not sampled. We keep p50, p90, p99, and the maximum for each API, each day. The number on a listing is the median because that is what people compare on, but the detail page shows the spread, and the status page shows the bad days rather than hiding them.

## What we do not do

We do not exclude errors from latency. A request that failed slowly still cost you the wait. We do not measure from inside our own network either — the figure includes the time to reach us.`,
    },
    {
      slug: "rate-limiting-bursty-clients",
      title: "Rate limiting without punishing bursty clients",
      tag: "Engineering",
      readMinutes: 9,
      excerpt:
        "Sliding windows, token buckets, and why we settled on a hybrid that absorbs a 10x burst without letting a runaway loop drain your quota.",
      body: `Rate limiting is a negotiation between two failure modes. Too strict and you break legitimate traffic that happens to arrive together. Too loose and one bug in a customer's retry loop consumes a month of allowance in an afternoon.

## Fixed windows are the worst of both

A fixed window resets on the minute, so a client can send its full allowance at 59 seconds and again at 61. You have permitted double the rate you advertised, and you did it at exactly the moment you were least prepared.

## What we run

A sliding window for the advertised per-minute limit, and a separate monthly quota that does not reset until the billing period does. The window absorbs a burst; the quota is what you actually bought.

## Failing usefully

A 429 carries Retry-After and the remaining allowance. A limit that does not tell you when to try again is just an error.`,
    },
    {
      slug: "one-error-envelope",
      title: "One error envelope across every provider",
      tag: "Engineering",
      readMinutes: 7,
      excerpt:
        "Normalising upstream failures is unglamorous work. It is also the single thing developers thank us for most.",
      body: `Every API fails differently. One returns 200 with an error field. Another returns 500 for a validation problem. A third returns a bare string.

## The cost of that variety

Handling it is the least interesting code in your codebase, and it is duplicated per vendor. Consolidating four providers behind us removed roughly four hundred lines of vendor-specific error handling from one customer's application.

## The shape

Every response carries a success boolean. Every failure carries a stable machine-readable code, a message written for a human, and a link to the documentation for that code. Status codes mean what the specification says they mean.

## Where it is hard

Some upstreams genuinely cannot distinguish between a bad request and an outage. We map those to a single code and say so in the reference, rather than guessing and being confidently wrong.`,
    },
    {
      slug: "what-a-free-tier-is-for",
      title: "A free tier is not a trial",
      tag: "Product",
      readMinutes: 4,
      excerpt:
        "A trial that expires is a deadline. A free tier that never expires lets you prototype on your own schedule and upgrade when traffic justifies it.",
      body: `Trials optimise for the vendor. They create urgency, and urgency converts. They also mean an engineer evaluating your product is doing it against a clock they did not set.

## What we do instead

Every listing has a tier that does not expire. It is small — a hundred calls a month — but it is permanent, and it is enough to build the whole integration before anyone has to approve a purchase order.

## The trade

We convert more slowly and later. We also stop losing the evaluation that got parked for a fortnight because a sprint went sideways.`,
    },
  ];

  for (const post of posts) {
    await sql`
      INSERT INTO posts (slug, title, excerpt, body, tag, read_minutes, published, published_at)
      VALUES (${post.slug}, ${post.title}, ${post.excerpt}, ${post.body}, ${post.tag},
              ${post.readMinutes}, true, now() - (${posts.indexOf(post) * 11}::text || ' days')::interval)
      ON CONFLICT (slug) DO UPDATE
        SET title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, body = EXCLUDED.body,
            tag = EXCLUDED.tag, read_minutes = EXCLUDED.read_minutes, updated_at = now()
    `;
  }

  const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@zephiel.dev").toLowerCase();
  // No default: a fixed, documented password would be a published credential
  // on any public repository.
  const generated = !process.env.ADMIN_PASSWORD;
  const adminPassword = process.env.ADMIN_PASSWORD ?? randomBytes(12).toString("base64url");

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
  process.exit(1);
} finally {
  await sql.end();
}
