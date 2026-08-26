/*
 * End-to-end check against a running server.
 *
 *   npx tsx scripts/e2e.mts [baseUrl]
 *
 * Drives the real HTTP surface the way a browser without JavaScript would:
 * server actions are submitted as multipart form posts using the hidden
 * action-reference fields Next.js renders for progressive enhancement.
 */
import { createHash, createHmac, randomBytes } from "node:crypto";
import postgres from "postgres";
import { loadEnv } from "./env.mts";

loadEnv();

const BASE = process.argv[2] ?? "http://localhost:3030";
const sql = postgres(process.env.DATABASE_URL!, { max: 1, ssl: false });

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const unescape = (v: string) =>
  v
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

/**
 * Pulls the hidden server-action fields out of ONE rendered form — the page can
 * hold several (sign out, each plan's subscribe button), and mixing their
 * action references together produces "Failed to find Server Action".
 * `marker` selects the form whose markup contains it.
 */
async function actionFields(path: string, marker: string, cookie = "") {
  const html = await (await fetch(`${BASE}${path}`, { headers: cookie ? { cookie } : {} })).text();

  const forms = html.split("<form").slice(1).map((f) => f.split("</form>")[0]);
  const form = forms.find((f) => f.includes(marker));
  if (!form) throw new Error(`No form containing ${marker} on ${path}`);

  const fields: Record<string, string> = {};
  for (const m of form.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
    const tag = m[0];
    const name = /name="([^"]*)"/.exec(tag)?.[1];
    const value = /value="([^"]*)"/.exec(tag)?.[1] ?? "";
    if (name) fields[name] = unescape(value);
  }
  return fields;
}

async function submit(
  path: string,
  values: Record<string, string>,
  cookie = "",
  marker = "$ACTION_"
) {
  const fields = await actionFields(path, marker, cookie);
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.append(k, v);
  for (const [k, v] of Object.entries(values)) body.append(k, v);

  return fetch(`${BASE}${path}`, {
    method: "POST",
    body,
    redirect: "manual",
    headers: cookie ? { cookie } : {},
  });
}

function sessionCookie(res: Response) {
  const raw = res.headers.get("set-cookie") ?? "";
  const m = /zephiel_session=([^;]+)/.exec(raw);
  return m ? `zephiel_session=${m[1]}` : "";
}

const email = `e2e_${Date.now()}@zephiel.test`;
const password = "supersecret123";

console.log(`\nRunning end-to-end checks against ${BASE}\n`);

try {
  // ------------------------------------------------------------- sign up --
  console.log("Signup & session");
  const signup = await submit("/signup", { name: "E2E Tester", email, password }, "", "$ACTION_");
  const cookie = sessionCookie(signup);
  check("signup creates a session cookie", cookie !== "", `status ${signup.status}`);

  const [user] = await sql<{ id: string; role: string }[]>`
    SELECT id, role FROM users WHERE email = ${email} LIMIT 1
  `;
  check("user row created", Boolean(user));
  check("new user defaults to customer role", user?.role === "customer");

  const keys = await sql<{ id: string }[]>`SELECT id FROM api_keys WHERE user_id = ${user.id}`;
  check("signup issues a default API key", keys.length === 1);

  // duplicate signup is rejected
  const dup = await submit("/signup", { name: "Dupe", email, password }, "", "$ACTION_");
  const dupCount = await sql<{ c: string }[]>`
    SELECT COUNT(*)::text AS c FROM users WHERE email = ${email}
  `;
  check("duplicate email is rejected", Number(dupCount[0].c) === 1, `status ${dup.status}`);

  // --------------------------------------------------------- authorised --
  console.log("\nAccess control");
  const dash = await fetch(`${BASE}/dashboard`, { headers: { cookie }, redirect: "manual" });
  check("signed-in user reaches /dashboard", dash.status === 200, `status ${dash.status}`);

  const adminAsCustomer = await fetch(`${BASE}/admin`, { headers: { cookie }, redirect: "manual" });
  check("customer is redirected away from /admin", adminAsCustomer.status === 307);

  const dashAnon = await fetch(`${BASE}/dashboard`, { redirect: "manual" });
  check("anonymous is redirected away from /dashboard", dashAnon.status === 307);

  // --------------------------------------------------------- admin login --
  console.log("\nAdmin");
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@zephiel.dev";
  const adminSignin = await submit("/signin", {
    email: adminEmail,
    password: process.env.ADMIN_PASSWORD ?? "zephiel-admin",
  }, "", "$ACTION_");
  const adminCookie = sessionCookie(adminSignin);
  check("admin can sign in", adminCookie !== "", `status ${adminSignin.status}`);

  for (const path of [
    "/admin",
    "/admin/apis",
    "/admin/categories",
    "/admin/users",
    "/admin/subscriptions",
    "/admin/payments",
  ]) {
    const res = await fetch(`${BASE}${path}`, { headers: { cookie: adminCookie }, redirect: "manual" });
    check(`admin can open ${path}`, res.status === 200, `status ${res.status}`);
  }

  const badLogin = await submit("/signin", { email: adminEmail, password: "wrong-password" }, "", "$ACTION_");
  check("wrong password does not create a session", sessionCookie(badLogin) === "");

  // ------------------------------------------------------ admin mutation --
  const slug = `e2e-api-${Date.now()}`;
  const created = await submit("/admin/apis/new", {
    slug,
    name: "E2E Test API",
    tagline: "Created by the end-to-end check.",
    description: "Temporary listing.",
    provider: "E2E",
    logo: "E2",
    color: "#2445d6",
    rating: "5",
    reviews: "0",
    subscribers: "0",
    latency: "50",
    uptime: "99.9",
    sampleResponse: '{"ok":true}',
    published: "on",
    freeTier: "on",
    tags: "test, e2e",
    useCases: "Testing",
  }, adminCookie, 'name="slug"');

  const [newApi] = await sql<{ id: string; published: boolean }[]>`
    SELECT id, published FROM apis WHERE slug = ${slug} LIMIT 1
  `;
  check("admin can create an API", Boolean(newApi), `status ${created.status}`);

  const listed = await fetch(`${BASE}/api/apis?q=e2e%20test`);
  const listedJson = await listed.json();
  check(
    "new API appears in the public catalog",
    listedJson.data?.some((a: { slug: string }) => a.slug === slug)
  );

  // ------------------------------------------------------- subscription --
  console.log("\nSubscription & gateway");

  // Subscribe the test user to a free plan on the seeded Multistore API.
  const [freePlan] = await sql<{ id: string; api_id: string; quota: number }[]>`
    SELECT p.id, p.api_id, p.quota FROM plans p
    JOIN apis a ON a.id = p.api_id
    WHERE a.slug = 'multistore' AND p.price = 0
    LIMIT 1
  `;

  const subRes = await submit("/marketplace/multistore", {
    planId: freePlan.id,
    apiSlug: "multistore",
    units: "1",
  }, cookie, `value="${freePlan.id}"`);

  const [sub] = await sql<{ id: string; status: string; quota: number; used: number }[]>`
    SELECT id, status, quota, used FROM subscriptions
    WHERE user_id = ${user.id} AND api_id = ${freePlan.api_id} LIMIT 1
  `;
  check("free plan activates without payment", sub?.status === "active", `status ${subRes.status}`);

  // Mint a key we know the plaintext of, matching src/lib/auth.ts exactly.
  // (That module imports server-only code, so the format is reproduced here.)
  const secret = randomBytes(20).toString("hex");
  const plaintext = `zk_live_${secret}`;
  const keyHash = createHash("sha256").update(plaintext).digest("hex");
  await sql`
    INSERT INTO api_keys (user_id, label, scope, key_prefix, key_hash)
    VALUES (${user.id}, 'E2E', 'All APIs', ${plaintext.slice(0, 11)}, ${keyHash})
  `;

  const gw = (headers: Record<string, string>) =>
    fetch(`${BASE}/api/v1/multistore/stores`, { headers });

  const noKey = await gw({});
  check("gateway rejects a request with no key", noKey.status === 401);

  const badKey = await gw({ "x-zephiel-key": "zk_live_notarealkey" });
  check("gateway rejects an unknown key", badKey.status === 401);

  {
    const ok = await gw({ "x-zephiel-key": plaintext });
    const okBody = await ok.json();
    check("gateway accepts a valid subscribed key", ok.status === 200, `status ${ok.status}`);
    check("gateway returns the API's response body", okBody?.success === true);
    check(
      "gateway sets rate-limit headers",
      ok.headers.get("x-ratelimit-limit") === String(sub.quota)
    );

    const [after] = await sql<{ used: number }[]>`
      SELECT used FROM subscriptions WHERE id = ${sub.id}
    `;
    check("call is metered against the quota", after.used === sub.used + 1);

    const [events] = await sql<{ c: string }[]>`
      SELECT COUNT(*)::text AS c FROM usage_events WHERE user_id = ${user.id}
    `;
    check("usage event is recorded", Number(events.c) === 1);

    // A key that is valid but has no subscription for this API.
    const other = await fetch(`${BASE}/api/v1/exchange-rates-data/latest`, {
      headers: { "x-zephiel-key": plaintext },
    });
    check("gateway rejects an unsubscribed API", other.status === 403, `status ${other.status}`);

    // Exhaust the quota and confirm the limit is enforced.
    await sql`UPDATE subscriptions SET used = quota WHERE id = ${sub.id}`;
    const overQuota = await gw({ "x-zephiel-key": plaintext });
    check("gateway enforces the quota", overQuota.status === 429, `status ${overQuota.status}`);
    await sql`UPDATE subscriptions SET used = 0 WHERE id = ${sub.id}`;

    // Revoked keys stop working.
    await sql`UPDATE api_keys SET revoked_at = now() WHERE key_hash IS NOT NULL AND user_id = ${user.id} AND label = 'E2E'`;
    const revoked = await gw({ "x-zephiel-key": plaintext });
    check("revoked key is rejected", revoked.status === 401, `status ${revoked.status}`);
  }

  // ---------------------------------------------------------- webhook ----
  console.log("\nPaystack webhook");
  const payload = JSON.stringify({ event: "charge.success", data: { reference: "nonexistent-ref" } });

  const unsigned = await fetch(`${BASE}/api/paystack/webhook`, {
    method: "POST",
    body: payload,
    headers: { "content-type": "application/json" },
  });
  check(
    "webhook rejects an unsigned payload",
    unsigned.status === 401 || unsigned.status === 503,
    `status ${unsigned.status}`
  );

  const webhookSecret = process.env.PAYSTACK_SECRET_KEY;
  if (webhookSecret) {
    const badSig = await fetch(`${BASE}/api/paystack/webhook`, {
      method: "POST",
      body: payload,
      headers: { "content-type": "application/json", "x-paystack-signature": "deadbeef" },
    });
    check("webhook rejects a wrong signature", badSig.status === 401, `status ${badSig.status}`);

    const sig = createHmac("sha512", webhookSecret).update(payload).digest("hex");
    const signed = await fetch(`${BASE}/api/paystack/webhook`, {
      method: "POST",
      body: payload,
      headers: { "content-type": "application/json", "x-paystack-signature": sig },
    });
    check("webhook accepts a correctly signed payload", signed.status === 200, `status ${signed.status}`);
  }

  // ------------------------------------------------------------ cleanup --
  await sql`DELETE FROM apis WHERE slug = ${slug}`;
  await sql`DELETE FROM users WHERE email = ${email}`;

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exitCode = failed === 0 ? 0 : 1;
} catch (err) {
  console.error("\nE2E run crashed:", err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
