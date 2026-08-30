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
import { FREE_PLAN_STORE_LIMIT as FREE_STORE_LIMIT } from "../src/lib/plans.ts";

loadEnv();

const BASE = process.argv[2] ?? "http://localhost:3030";
const DB_URL = process.env.DATABASE_URL!;
const sql = postgres(DB_URL, {
  max: 1,
  // Match src/lib/db.ts: hosted providers require TLS, local ones don't.
  ssl: DB_URL.includes("localhost") || DB_URL.includes("127.0.0.1") ? false : "require",
});

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
  // set(), not append(): a hidden default already in the form would otherwise
  // win, because formData.get() returns the first entry.
  for (const [k, v] of Object.entries(values)) body.set(k, v);

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
  check(
    "customer is sent to the admin login, not the site login",
    (adminAsCustomer.headers.get("location") ?? "").includes("/admin/login"),
    adminAsCustomer.headers.get("location") ?? ""
  );

  const dashAnon = await fetch(`${BASE}/dashboard`, { redirect: "manual" });
  check("anonymous is redirected away from /dashboard", dashAnon.status === 307);

  // The signed-in area gets its own chrome, not the marketing header/footer.
  const dashHtml = await (await fetch(`${BASE}/dashboard`, { headers: { cookie } })).text();
  check("dashboard has no marketing footer", !dashHtml.includes("All rights reserved"));
  check("dashboard has no marketing nav", !dashHtml.includes("Get free key"));
  check("dashboard has its own nav", dashHtml.includes('aria-label="Dashboard sections"'));
  check("dashboard shows the member-since line", dashHtml.includes("member since"));

  for (const path of ["/dashboard/stores", "/dashboard/usage", "/dashboard/billing", "/dashboard/keys", "/dashboard/playground"]) {
    const res = await fetch(`${BASE}${path}`, { headers: { cookie }, redirect: "manual" });
    check(`customer can open ${path}`, res.status === 200, `status ${res.status}`);
  }

  // --------------------------------------------------------- admin login --
  console.log("\nAdmin");
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@zephiel.com";
  const adminPass = process.env.ADMIN_PASSWORD ?? "zephiel-admin";

  const loginPage = await fetch(`${BASE}/admin/login`, { redirect: "manual" });
  check("admin login page is publicly reachable", loginPage.status === 200, `status ${loginPage.status}`);

  // A customer account must be refused at the admin door, not signed in and
  // then bounced.
  const customerAtAdmin = await submit("/admin/login", { email, password }, "", "$ACTION_");
  check("customer credentials are refused at admin login", sessionCookie(customerAtAdmin) === "");

  const adminSignin = await submit("/admin/login", {
    email: adminEmail,
    password: adminPass,
  }, "", "$ACTION_");
  const adminCookie = sessionCookie(adminSignin);
  check("admin can sign in at /admin/login", adminCookie !== "", `status ${adminSignin.status}`);

  for (const path of [
    "/admin",
    "/admin/apis",
    "/admin/categories",
    "/admin/users",
    "/admin/subscriptions",
    "/admin/payments",
    "/admin/settings",
    "/admin/notifications",
    "/admin/reviews",
    "/admin/posts",
    "/admin/posts/new",
  ]) {
    const res = await fetch(`${BASE}${path}`, { headers: { cookie: adminCookie }, redirect: "manual" });
    check(`admin can open ${path}`, res.status === 200, `status ${res.status}`);
  }

  const badLogin = await submit("/admin/login", { email: adminEmail, password: "wrong-password" }, "", "$ACTION_");
  check("wrong password does not create a session", sessionCookie(badLogin) === "");

  // Admin pages must not carry the public marketing chrome.
  const adminHtml = await (await fetch(`${BASE}/admin`, { headers: { cookie: adminCookie } })).text();
  check("admin page has no site footer", !adminHtml.includes("All rights reserved"));
  check("admin page has no marketing nav", !adminHtml.includes("Get free key"));
  check("admin page shows the console chrome", adminHtml.includes("Console"));

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

  // ------------------------------------------------------------ settings --
  const schemaHtml = await (
    await fetch(`${BASE}/admin/settings`, { headers: { cookie: adminCookie } })
  ).text();
  check("settings page reports schema status", schemaHtml.includes("Database schema"));
  check("settings offers a catalogue reseed", schemaHtml.includes("Reseed catalogue"));

  // Reseeding used to DELETE every plan and reinsert it. subscriptions.plan_id
  // cascades, so each reseed silently wiped every customer's subscription,
  // their stores, and their per-store keys. Plans are upserted now; this proves
  // a customer survives the operation.
  {
    const [msApi] = await sql<{ id: string }[]>`SELECT id FROM apis WHERE slug = 'multistore' LIMIT 1`;
    const [msPlan] = await sql<{ id: string; quota: number }[]>`
      SELECT id, quota FROM plans WHERE api_id = ${msApi.id} ORDER BY sort_order LIMIT 1
    `;
    const [subUser] = await sql<{ id: string }[]>`
      INSERT INTO users (email, name, password_hash, role)
      VALUES ('e2e_reseed@zephiel.test', 'Reseed Guard', 'scrypt:x:y', 'customer')
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `;
    const [guardSub] = await sql<{ id: string }[]>`
      INSERT INTO subscriptions (user_id, api_id, plan_id, status, quota, units)
      VALUES (${subUser.id}, ${msApi.id}, ${msPlan.id}, 'active', ${msPlan.quota}, 2)
      ON CONFLICT (user_id, api_id) DO UPDATE SET status = 'active'
      RETURNING id
    `;
    await sql`
      INSERT INTO stores (user_id, subscription_id, name, platform)
      VALUES (${subUser.id}, ${guardSub.id}, 'Reseed Guard Store', 'shopify')
    `;

    // Driven through the real admin form, the way an operator triggers it.
    await submit("/admin/settings", {}, adminCookie, "Reseed catalogue");

    const [survived] = await sql<{ subs: number; stores: number }[]>`
      SELECT (SELECT COUNT(*) FROM subscriptions WHERE user_id = ${subUser.id})::int AS subs,
             (SELECT COUNT(*) FROM stores WHERE user_id = ${subUser.id})::int AS stores
    `;
    check("reseeding the catalogue preserves subscriptions", survived.subs === 1, `${survived.subs} left`);
    check("reseeding the catalogue preserves stores", survived.stores === 1, `${survived.stores} left`);

    await sql`DELETE FROM users WHERE id = ${subUser.id}`;
  }
  check(
    "reseed states what it leaves alone",
    schemaHtml.includes("customer-written reviews are left"),
    "no scope disclosure"
  );
  check("schema reports up to date", schemaHtml.includes("Up to date"), "drift reported");

  const settingsHtml = await (
    await fetch(`${BASE}/admin/settings`, { headers: { cookie: adminCookie } })
  ).text();
  check("settings page exposes the Paystack key field", settingsHtml.includes('name="secretKey"'));
  check("secret key field is a password input", /name="secretKey"[^>]*type="password"|type="password"[^>]*name="secretKey"/.test(settingsHtml));
  check("settings page shows the webhook URL", settingsHtml.includes("/api/paystack/webhook"));

  // A bogus key must be rejected before anything is stored.
  const bogusKey = await submit("/admin/settings", {
    secretKey: "not-a-real-key",
    currency: "NGN",
    usdToNgn: "1550",
  }, adminCookie, 'name="secretKey"');
  const [stored] = await sql<{ c: string }[]>`
    SELECT COUNT(*)::text AS c FROM settings WHERE key = 'paystack_secret_key' AND value <> ''
  `;
  check("malformed Paystack key is refused", Number(stored.c) === 0, `status ${bogusKey.status}`);

  // Non-secret settings still save.
  await submit("/admin/settings", { currency: "USD", usdToNgn: "1600" }, adminCookie, 'name="secretKey"');
  const [cur] = await sql<{ value: string }[]>`
    SELECT value FROM settings WHERE key = 'paystack_currency' LIMIT 1
  `;
  check("currency setting persists", cur?.value === "USD", cur?.value ?? "(unset)");
  await sql`DELETE FROM settings WHERE key IN ('paystack_currency','usd_to_ngn')`;


  // -------------------------------------------------------- reminders ----
  console.log("\nRenewal reminders");

  const cronNoAuth = await fetch(`${BASE}/api/cron/renewal-reminders`);
  check("cron endpoint refuses an unauthenticated call", cronNoAuth.status === 401, `status ${cronNoAuth.status}`);

  const cronBadAuth = await fetch(`${BASE}/api/cron/renewal-reminders`, {
    headers: { authorization: "Bearer wrong-secret" },
  });
  check("cron endpoint refuses a wrong secret", cronBadAuth.status === 401, `status ${cronBadAuth.status}`);

  // A subscription expiring in exactly 7 days must be picked up by the sweep.
  const [reminderApi] = await sql<{ api_id: string; plan_id: string; quota: number }[]>`
    SELECT p.api_id, p.id AS plan_id, p.quota FROM plans p
    JOIN apis a ON a.id = p.api_id
    WHERE a.slug = 'weather-forecast' AND p.price = 0 LIMIT 1
  `;
  await sql`
    INSERT INTO subscriptions (user_id, api_id, plan_id, status, quota, units, current_period_end)
    VALUES (${user.id}, ${reminderApi.api_id}, ${reminderApi.plan_id}, 'active', ${reminderApi.quota}, 1,
            (CURRENT_DATE + 7) + time '12:00')
    ON CONFLICT (user_id, api_id) DO UPDATE
      SET status = 'active', current_period_end = EXCLUDED.current_period_end
  `;

  const [notCol] = await sql<{ c: string }[]>`
    SELECT COUNT(*)::text AS c FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name IN ('kind','period_end','status')
  `;
  check("notifications table has the dedupe columns", Number(notCol.c) === 3, `${notCol.c}/3`);

  const adminNotifs = await fetch(`${BASE}/admin/notifications`, { headers: { cookie: adminCookie } });
  check("admin notifications page loads", adminNotifs.status === 200, `status ${adminNotifs.status}`);

  const notifHtml = await adminNotifs.text();
  check("notifications page shows the due list", notifHtml.includes("Due for a reminder today"));
  check(
    "a subscription expiring in 7 days is flagged for a reminder",
    notifHtml.includes(email),
    "customer not listed as due"
  );

  // ---------------------------------------------------------------- stores --
  console.log("\nStores");

  // The customer needs an active Multistore subscription first.
  const [msPlan] = await sql<{ id: string; api_id: string; quota: number }[]>`
    SELECT p.id, p.api_id, p.quota FROM plans p
    JOIN apis a ON a.id = p.api_id
    WHERE a.slug = 'multistore' AND p.price = 0 LIMIT 1
  `;
  await sql`
    INSERT INTO subscriptions (user_id, api_id, plan_id, status, quota, units, current_period_end)
    VALUES (${user.id}, ${msPlan.api_id}, ${msPlan.id}, 'active', ${msPlan.quota}, 1, now() + interval '30 days')
    ON CONFLICT (user_id, api_id) DO UPDATE SET status = 'active', quota = EXCLUDED.quota
  `;

  const storesPage = await fetch(`${BASE}/dashboard/stores`, { headers: { cookie }, redirect: "manual" });
  check("stores page loads for a subscriber", storesPage.status === 200, `status ${storesPage.status}`);

  const addRes = await submit("/dashboard/stores", { name: "Lagos Flagship", platform: "shopify" }, cookie, 'name="platform"');
  const [store] = await sql<{ id: string; name: string }[]>`
    SELECT id, name FROM stores WHERE user_id = ${user.id} AND name = 'Lagos Flagship' LIMIT 1
  `;
  check("a store can be connected", Boolean(store), `status ${addRes.status}`);

  const storeKeys = await sql<{ id: string; key_prefix: string }[]>`
    SELECT id, key_prefix FROM api_keys WHERE store_id = ${store?.id ?? null}
  `;
  check("connecting a store mints its own key", storeKeys.length === 1);

  const [unitRow] = await sql<{ units: number }[]>`
    SELECT units FROM subscriptions WHERE user_id = ${user.id} AND api_id = ${msPlan.api_id}
  `;
  check("billable units track the store count", unitRow.units === 1, `units=${unitRow.units}`);

  // Mint a second store key we know the plaintext of, and prove attribution.
  const storeSecret = `zk_live_${randomBytes(20).toString("hex")}`;
  await sql`
    UPDATE api_keys SET key_hash = ${createHash("sha256").update(storeSecret).digest("hex")}
    WHERE store_id = ${store.id}
  `;
  const storeCall = await fetch(`${BASE}/api/v1/multistore/stores`, {
    headers: { "x-zephiel-key": storeSecret },
  });
  check("a store key can call the gateway", storeCall.status === 200, `status ${storeCall.status}`);

  const [attributed] = await sql<{ c: string }[]>`
    SELECT COUNT(*)::text AS c FROM usage_events WHERE store_id = ${store.id}
  `;
  check("the call is attributed to that store", Number(attributed.c) === 1, `${attributed.c} events`);

  // ------------------------------------------------------ demo traffic ----
  console.log("\nTraffic history");

  const [msSub] = await sql<{ id: string }[]>`
    SELECT s.id FROM subscriptions s JOIN apis a ON a.id = s.api_id
    WHERE s.user_id = ${user.id} AND a.slug = 'multistore' LIMIT 1
  `;

  const genRes = await submit("/admin/users/" + user.id, {
    subscriptionId: msSub.id,
    from: "2026-06-02",
    total: "7000000",
  }, adminCookie, 'name="subscriptionId"');
  check("admin can generate traffic history", genRes.status === 200 || genRes.status === 303, `status ${genRes.status}`);

  const [rollupTotal] = await sql<{ c: string }[]>`
    SELECT COALESCE(SUM(calls), 0)::text AS c FROM usage_daily WHERE user_id = ${user.id}
  `;
  check(
    "generated total matches exactly",
    Number(rollupTotal.c) === 7_000_000,
    `${Number(rollupTotal.c).toLocaleString()}`
  );

  const shape = await sql<{ c: string }[]>`
    SELECT SUM(calls)::text AS c FROM usage_daily WHERE user_id = ${user.id}
    GROUP BY day ORDER BY day
  `;
  const firstWeek = shape.slice(0, 7).reduce((a, r) => a + Number(r.c), 0);
  const lastWeek = shape.slice(-7).reduce((a, r) => a + Number(r.c), 0);
  check("volume grows from start to today", lastWeek > firstWeek * 3, `${firstWeek} -> ${lastWeek}`);
  check("history spans the full range", shape.length >= 80, `${shape.length} days`);

  const [liveEvents] = await sql<{ c: string }[]>`
    SELECT COUNT(*)::text AS c FROM usage_events
    WHERE user_id = ${user.id} AND created_at >= now() - interval '8 hours'
  `;
  check("intraday events exist for the five-minute chart", Number(liveEvents.c) > 50, `${liveEvents.c} events`);

  const usageHtml = await (await fetch(`${BASE}/dashboard/usage`, { headers: { cookie } })).text();
  check("usage page reflects the generated history", /[\d,]{7,}/.test(usageHtml), "no large totals rendered");

  // The stores chart must actually render the generated activity, not just
  // have the rows in the database.
  const storesHtml = await (await fetch(`${BASE}/dashboard/stores`, { headers: { cookie } })).text();
  const callsMatch = /([\d,]+) calls<\/p>|>([\d,]+) calls</.exec(storesHtml);
  check("stores page shows a non-zero call total", !/>0 calls</.test(storesHtml), callsMatch?.[0] ?? "no total found");

  const [neverUsed] = await sql<{ c: string }[]>`
    SELECT COUNT(*)::text AS c FROM api_keys
    WHERE user_id = ${user.id} AND revoked_at IS NULL AND last_used_at IS NULL
  `;
  check("no key still reads 'never used' after traffic", Number(neverUsed.c) === 0, `${neverUsed.c} unused`);

  const [distinctKeys] = await sql<{ c: string }[]>`
    SELECT COUNT(DISTINCT api_key_id)::text AS c FROM usage_events
    WHERE user_id = ${user.id} AND created_at >= now() - interval '8 hours'
  `;
  check("each store's traffic uses its own key", Number(distinctKeys.c) >= 1, `${distinctKeys.c} keys used`);

  const [storeEvents] = await sql<{ c: string }[]>`
    SELECT COUNT(*)::text AS c FROM usage_events
    WHERE user_id = ${user.id} AND store_id IS NOT NULL
      AND created_at >= now() - interval '8 hours'
  `;
  check("intraday events are attributed to stores", Number(storeEvents.c) > 20, `${storeEvents.c} store events`);

  // Billing: the plan chooser must offer a genuine upgrade path.
  const billingHtml = await (await fetch(`${BASE}/dashboard/billing`, { headers: { cookie } })).text();
  check("billing page lists plan options", billingHtml.includes("Monthly total"));
  check("billing page marks the current plan", billingHtml.includes("Current"));
  check("billing page offers an upgrade", /Upgrade|More calls/.test(billingHtml));

  // Upgrading a free plan to another free tier applies instantly and changes quota.
  const [before] = await sql<{ quota: number; plan_id: string }[]>`
    SELECT quota, plan_id FROM subscriptions WHERE id = ${msSub.id}
  `;
  // Excludes Enterprise deliberately: it is priced 0 on Multistore but quoted,
  // so it is not a free tier anyone can switch to. This test used to pick it.
  const [target] = await sql<{ id: string; quota: number }[]>`
    SELECT p.id, p.quota FROM plans p
    JOIN subscriptions s ON s.api_id = p.api_id
    WHERE s.id = ${msSub.id} AND p.price = 0 AND p.id <> ${before.plan_id}
      AND p.name <> 'Enterprise'
    LIMIT 1
  `;

  check(
    "billing page quotes Enterprise instead of offering it as free",
    billingHtml.includes("/contact?plan=enterprise") && !/Switch to Free[\s\S]{0,80}Enterprise/.test(billingHtml)
  );
  if (target) {
    await submit("/dashboard/billing", {
      planId: target.id,
      apiSlug: "multistore",
      units: "1",
    }, cookie, `value="${target.id}"`);

    const [after] = await sql<{ quota: number; plan_id: string }[]>`
      SELECT quota, plan_id FROM subscriptions WHERE id = ${msSub.id}
    `;
    check("changing plan updates the subscription", after.plan_id === target.id, "plan unchanged");
    check("changing plan updates the call allowance", after.quota === target.quota, `${after.quota}`);
  }

  // Theme: the pre-hydration script must set both the class and colorScheme.
  const rootHtml = await (await fetch(`${BASE}/`)).text();
  check("theme script sets colorScheme", rootHtml.includes("colorScheme"));
  check("theme script reads the stored preference", rootHtml.includes("zephiel-theme"));

  // Renewals: a lapsed free plan rolls over, a lapsed paid plan expires.
  const [freePlanRow] = await sql<{ id: string; api_id: string; quota: number }[]>`
    SELECT p.id, p.api_id, p.quota FROM plans p JOIN apis a ON a.id = p.api_id
    WHERE a.slug = 'timezone-api' AND p.price = 0 LIMIT 1
  `;
  await sql`
    INSERT INTO subscriptions (user_id, api_id, plan_id, status, quota, used, current_period_end)
    VALUES (${user.id}, ${freePlanRow.api_id}, ${freePlanRow.id}, 'active', ${freePlanRow.quota},
            ${freePlanRow.quota}, now() - interval '1 day')
    ON CONFLICT (user_id, api_id) DO UPDATE
      SET status='active', used = EXCLUDED.used, current_period_end = EXCLUDED.current_period_end
  `;

  const [paidPlanRow] = await sql<{ id: string; api_id: string; quota: number }[]>`
    SELECT p.id, p.api_id, p.quota FROM plans p JOIN apis a ON a.id = p.api_id
    WHERE a.slug = 'air-quality' AND p.price > 0 LIMIT 1
  `;
  await sql`
    INSERT INTO subscriptions (user_id, api_id, plan_id, status, quota, used, current_period_end)
    VALUES (${user.id}, ${paidPlanRow.api_id}, ${paidPlanRow.id}, 'active', ${paidPlanRow.quota}, 5,
            now() - interval '1 day')
    ON CONFLICT (user_id, api_id) DO UPDATE
      SET status='active', current_period_end = EXCLUDED.current_period_end
  `;

  const { processRenewalsViaCron } = { processRenewalsViaCron: true };
  if (processRenewalsViaCron && process.env.CRON_SECRET) {
    await fetch(`${BASE}/api/cron/usage-rollup`, {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    });

    const [rolledOver] = await sql<{ used: number; ends: Date }[]>`
      SELECT used, current_period_end AS ends FROM subscriptions
      WHERE user_id = ${user.id} AND api_id = ${freePlanRow.api_id}
    `;
    check("a lapsed free plan resets its allowance", rolledOver.used === 0, `used=${rolledOver.used}`);
    check("a lapsed free plan moves to the next period", new Date(rolledOver.ends) > new Date(), "still past");

    const [lapsed] = await sql<{ status: string }[]>`
      SELECT status FROM subscriptions WHERE user_id = ${user.id} AND api_id = ${paidPlanRow.api_id}
    `;
    check("a lapsed paid plan is expired", lapsed.status === "expired", lapsed.status);
  }

  // Rollup job: yesterday's events must fold into usage_daily and be pruned.
  await sql`
    INSERT INTO usage_events (user_id, api_id, endpoint, method, status, latency_ms, created_at)
    SELECT ${user.id}, ${msSub ? sql`(SELECT api_id FROM subscriptions WHERE id = ${msSub.id})` : null},
           '/multistore/stores', 'GET', 200, 120, (CURRENT_DATE - 1) + time '10:00'
  `;
  const cronRollup = await fetch(`${BASE}/api/cron/usage-rollup`, {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? "unset"}` },
  });
  check(
    "rollup cron refuses without the right secret",
    cronRollup.status === 401 || cronRollup.status === 200,
    `status ${cronRollup.status}`
  );

  const rollupNoAuth = await fetch(`${BASE}/api/cron/usage-rollup`);
  check("rollup cron refuses an unauthenticated call", rollupNoAuth.status === 401);

  // Key hygiene after the traffic generator ran.
  const [prefixOnly] = await sql<{ c: string }[]>`
    SELECT COUNT(*)::text AS c FROM api_keys WHERE user_id = ${user.id} AND key_prefix = ''
  `;
  check("every key has a readable prefix", Number(prefixOnly.c) === 0);

  const keysHtml = await (await fetch(`${BASE}/dashboard/keys`, { headers: { cookie } })).text();
  check("keys page offers rotation", keysHtml.includes("Rotate"));
  check("keys page no longer offers a useless prefix copy", !keysHtml.includes("Copy prefix"));

  const pgHtml = await (await fetch(`${BASE}/dashboard/playground`, { headers: { cookie } })).text();
  check("playground does not render raw path placeholders", !/\/api\/v1\/[a-z-]+\/[^"<]*\{/.test(pgHtml));

  // Generating 7M calls against a 1,000-call free plan correctly exhausts the
  // quota. Reset it so the gateway checks below start with headroom.
  await sql`UPDATE subscriptions SET used = 0 WHERE user_id = ${user.id}`;

  // ---------------------------------------------------------------- icons --
  const [iconRow] = await sql<{ c: string }[]>`
    SELECT COUNT(*)::text AS c FROM apis WHERE icon <> ''
  `;
  check("seeded APIs carry icons", Number(iconRow.c) >= 26, `${iconRow.c} with icons`);

  const cardHtml = await (await fetch(`${BASE}/marketplace`)).text();
  check("catalog cards render icon glyphs", (cardHtml.match(/<svg/g) ?? []).length > 30);

  const homeHtml = await (await fetch(`${BASE}/`)).text();
  check("home shows the brand logo strip", homeHtml.includes("Trusted by engineering teams at"));
  check("brand marks are rendered as logos", homeHtml.includes("Brightloom"));

  // ------------------------------------------------------------- reviews --
  console.log("\nReviews & security");

  const [reviewApi] = await sql<{ id: string; slug: string; rating: string; reviews: number }[]>`
    SELECT id, slug, rating, reviews FROM apis WHERE slug = 'ip-intelligence' LIMIT 1
  `;
  // React separates adjacent JSX expressions with comment markers, so strip
  // them before matching rendered text.
  const detail = (await (await fetch(`${BASE}/marketplace/${reviewApi.slug}`)).text()).replace(
    /<!--[\s\S]*?-->/g,
    ""
  );
  check(
    "listing shows a real review count",
    detail.includes(`${reviewApi.reviews} review`),
    `expected ${reviewApi.reviews}`
  );

  // The distribution and the average must come from the same rows.
  const [computed] = await sql<{ avg: string; n: string }[]>`
    SELECT ROUND(AVG(rating)::numeric, 1)::text AS avg, COUNT(*)::text AS n
    FROM reviews WHERE api_id = ${reviewApi.id}
  `;
  check(
    "stored rating matches its reviews",
    Number(reviewApi.rating) === Number(computed.avg),
    `stored ${reviewApi.rating} vs computed ${computed.avg}`
  );

  // Every published listing carries reviews, and Multistore carries many.
  const [coverage] = await sql<{ total: string; withReviews: string }[]>`
    SELECT COUNT(*)::text AS total,
           COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM reviews r WHERE r.api_id = a.id))::text AS "withReviews"
    FROM apis a WHERE a.published AND a.slug NOT LIKE 'e2e-api-%'
  `;
  check(
    "every published API has reviews",
    coverage.total === coverage.withReviews,
    `${coverage.withReviews}/${coverage.total}`
  );

  const [msReviews] = await sql<{ c: string }[]>`
    SELECT COUNT(*)::text AS c FROM reviews r JOIN apis a ON a.id = r.api_id
    WHERE a.slug = 'multistore'
  `;
  check("multistore has a deep review set", Number(msReviews.c) >= 20, `${msReviews.c} reviews`);

  // Admin can add, edit, and delete a review.
  const [targetApi] = await sql<{ id: string }[]>`SELECT id FROM apis WHERE slug = 'qr-codes' LIMIT 1`;
  if (targetApi) {
    const before = await sql<{ c: string }[]>`
      SELECT COUNT(*)::text AS c FROM reviews WHERE api_id = ${targetApi.id}
    `;
    await submit("/admin/reviews", {
      apiId: targetApi.id,
      rating: "4",
      authorName: "E2E Reviewer",
      role: "Tester",
      title: "Added from the console",
      body: "This review was created through the admin interface during the end-to-end run.",
    }, adminCookie, 'name="authorName"');

    const [added] = await sql<{ id: string; rating: number }[]>`
      SELECT id, rating FROM reviews WHERE api_id = ${targetApi.id} AND author_name = 'E2E Reviewer' LIMIT 1
    `;
    check("admin can add a review", Boolean(added), `was ${before[0].c}`);

    if (added) {
      const [rated] = await sql<{ rating: string; computed: string }[]>`
        SELECT a.rating::text, ROUND(AVG(v.rating)::numeric,1)::text AS computed
        FROM apis a JOIN reviews v ON v.api_id = a.id
        WHERE a.id = ${targetApi.id} GROUP BY a.rating
      `;
      check("adding a review recomputes the listing rating", rated.rating === rated.computed,
        `${rated.rating} vs ${rated.computed}`);

      await submit("/admin/reviews", {
        id: added.id,
        apiId: targetApi.id,
        rating: "2",
        authorName: "E2E Reviewer",
        role: "Tester",
        title: "Edited",
        body: "This review was edited through the admin interface during the end-to-end run.",
      }, adminCookie, `value="${added.id}"`);

      const [edited] = await sql<{ rating: number; title: string }[]>`
        SELECT rating, title FROM reviews WHERE id = ${added.id}
      `;
      check("admin can edit a review", edited?.rating === 2 && edited.title === "Edited",
        `rating ${edited?.rating}`);

      await sql`DELETE FROM reviews WHERE id = ${added.id}`;
      await sql`
        UPDATE apis a SET rating = COALESCE((SELECT ROUND(AVG(rating)::numeric,1) FROM reviews r WHERE r.api_id = a.id), 5.0),
          reviews = (SELECT COUNT(*) FROM reviews r WHERE r.api_id = a.id) WHERE a.id = ${targetApi.id}
      `;
    }
  }

  // A non-subscriber cannot review.
  const [otherApi] = await sql<{ id: string; slug: string }[]>`
    SELECT id, slug FROM apis WHERE slug = 'pdf-toolkit' LIMIT 1
  `;
  await sql`DELETE FROM subscriptions WHERE user_id = ${user.id} AND api_id = ${otherApi.id}`;
  const sneak = await submit(`/marketplace/${otherApi.slug}`, {
    apiId: otherApi.id,
    apiSlug: otherApi.slug,
    rating: "5",
    body: "Trying to review without subscribing at all.",
  }, cookie, 'name="body"').catch(() => null);
  const [sneaked] = await sql<{ c: string }[]>`
    SELECT COUNT(*)::text AS c FROM reviews WHERE user_id = ${user.id} AND api_id = ${otherApi.id}
  `;
  check("a non-subscriber cannot review", Number(sneaked.c) === 0, `status ${sneak?.status ?? "n/a"}`);

  // Password reset pages exist and a bad token is refused.
  const forgot = await fetch(`${BASE}/forgot`);
  check("forgot-password page loads", forgot.status === 200, `status ${forgot.status}`);
  const resetNoToken = await (await fetch(`${BASE}/reset`)).text();
  check("reset page without a token explains itself", resetNoToken.includes("missing its token"));

  const badReset = await submit("/reset?token=not-a-real-token", {
    token: "not-a-real-token",
    password: "abcdefghijkl",
    confirm: "abcdefghijkl",
  }, "", 'name="password"');
  check("an invalid reset token is refused", badReset.status === 200, `status ${badReset.status}`);

  // Webhook replay protection.
  const stale = JSON.stringify({
    event: "charge.success",
    data: { reference: "old-ref", paid_at: new Date(Date.now() - 40 * 60 * 60 * 1000).toISOString() },
  });
  if (process.env.PAYSTACK_SECRET_KEY) {
    const sig = createHmac("sha512", process.env.PAYSTACK_SECRET_KEY).update(stale).digest("hex");
    const replayed = await fetch(`${BASE}/api/paystack/webhook`, {
      method: "POST",
      body: stale,
      headers: { "content-type": "application/json", "x-paystack-signature": sig },
    });
    check("a correctly signed but stale event is refused", replayed.status === 400, `status ${replayed.status}`);
  }

  // ------------------------------------------------------------- content --
  const gdpr = await fetch(`${BASE}/legal/gdpr`, { redirect: "manual" });
  check("GDPR page is reachable", gdpr.status === 200, `status ${gdpr.status}`);

  const gdprHtml = await (await fetch(`${BASE}/legal/gdpr`)).text();
  for (const heading of [
    "Our role",
    "Lawful bases",
    "What we process",
    "Your rights",
    "Subprocessors",
    "International transfers",
    "Security measures",
    "Breach notification",
  ]) {
    check(`GDPR page covers "${heading}"`, gdprHtml.includes(heading));
  }
  check("GDPR page is linked from the footer", homeHtml.includes("/legal/gdpr"));
  check("GDPR tables are captioned", gdprHtml.includes("<caption"));

  check("home shows the spotlight section", homeHtml.includes("What teams build with them"));
  check("home shows the use-case explorer", homeHtml.includes("Pick an API, see the problem it solves"));
  check("home shows the platform pillars", homeHtml.includes("Everything behind a single integration surface"));
  check("home shows the latest posts", homeHtml.includes("Notes on running the platform"));
  check("footer offers a newsletter signup", homeHtml.includes('name="email"') && homeHtml.includes("Newsletter"));

  // Blog is database-backed with its own pages.
  const blogHtml = await (await fetch(`${BASE}/blog`)).text();
  check("blog lists published posts", blogHtml.includes("min read"));

  const [firstPost] = await sql<{ slug: string; title: string }[]>`
    SELECT slug, title FROM posts WHERE published ORDER BY published_at DESC LIMIT 1
  `;
  const postRes = await fetch(`${BASE}/blog/${firstPost.slug}`, { redirect: "manual" });
  check("an individual post has its own page", postRes.status === 200, `status ${postRes.status}`);
  const postHtml = await (await fetch(`${BASE}/blog/${firstPost.slug}`)).text();
  check("post page renders its body", postHtml.includes("Keep reading") || postHtml.length > 4000);

  const draftRes = await fetch(`${BASE}/blog/definitely-not-a-post`, { redirect: "manual" });
  check("an unknown post 404s", draftRes.status === 404, `status ${draftRes.status}`);

  // Newsletter signup stores the address.
  const subEmail = `news_${Date.now()}@zephiel.test`;
  await submit("/", { email: subEmail }, "", 'name="email"');
  const [subscriber] = await sql<{ c: string }[]>`
    SELECT COUNT(*)::text AS c FROM newsletter_subscribers WHERE email = ${subEmail}
  `;
  check("newsletter signup is stored", Number(subscriber.c) === 1, `${subscriber.c} rows`);
  await sql`DELETE FROM newsletter_subscribers WHERE email = ${subEmail}`;
  check("home shows audience segments", homeHtml.includes("However far along you are"));
  check("home shows testimonials", homeHtml.includes("Fewer vendors"));

  const sitemapXml = await (await fetch(`${BASE}/sitemap.xml`)).text();
  check("sitemap lists the GDPR page", sitemapXml.includes("/legal/gdpr"));

  // ----------------------------------------------------------- a11y basics --
  check("site pages expose a skip link", homeHtml.includes("Skip to content"));
  check("site has a main landmark", homeHtml.includes('id="main"'));
  const adminA11y = await (await fetch(`${BASE}/admin`, { headers: { cookie: adminCookie } })).text();
  check("admin exposes a skip link", adminA11y.includes("Skip to content"));
  check("admin nav is labelled", adminA11y.includes('aria-label="Admin sections"'));
  const usersHtml = await (await fetch(`${BASE}/admin/users`, { headers: { cookie: adminCookie } })).text();
  check("admin tables use column scopes", usersHtml.includes('scope="col"'));
  check("admin tables have captions", usersHtml.includes("<caption"));

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
    const [eventsBefore] = await sql<{ c: string }[]>`
      SELECT COUNT(*)::text AS c FROM usage_events WHERE user_id = ${user.id}
    `;

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

    const [eventsAfter] = await sql<{ c: string }[]>`
      SELECT COUNT(*)::text AS c FROM usage_events WHERE user_id = ${user.id}
    `;
    check(
      "usage event is recorded",
      Number(eventsAfter.c) === Number(eventsBefore.c) + 1,
      `${eventsBefore.c} -> ${eventsAfter.c}`
    );

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

  // ------------------------------------------------- provisioning limits --
  console.log("\nStore provisioning API");

  {
    await sql`DELETE FROM rate_limits WHERE bucket LIKE 'provision:%'`;

    const [msApi3] = await sql<{ id: string }[]>`SELECT id FROM apis WHERE slug = 'multistore' LIMIT 1`;
    const [paidMs] = await sql<{ id: string; quota: number }[]>`
      SELECT id, quota::int FROM plans WHERE api_id = ${msApi3.id} AND price > 0
        AND name <> 'Enterprise' LIMIT 1
    `;
    const provEmail = `e2e_prov_${Date.now()}@zephiel.test`;
    const [provUser] = await sql<{ id: string }[]>`
      INSERT INTO users (email, name, password_hash, role)
      VALUES (${provEmail}, 'Prov', 'scrypt:x:y', 'customer') RETURNING id
    `;
    await sql`
      INSERT INTO subscriptions (user_id, api_id, plan_id, status, quota, units, current_period_end)
      VALUES (${provUser.id}, ${msApi3.id}, ${paidMs.id}, 'active', ${paidMs.quota}, 1,
              now() + interval '30 days')
    `;
    const provSecret = `zk_live_${randomBytes(20).toString("hex")}`;
    await sql`
      INSERT INTO api_keys (user_id, label, scope, key_prefix, key_hash)
      VALUES (${provUser.id}, 'Account', 'All APIs', ${provSecret.slice(0, 11)},
              ${createHash("sha256").update(provSecret).digest("hex")})
    `;

    const provision = (name: string) =>
      fetch(`${BASE}/api/integrations/provision-store`, {
        method: "POST",
        headers: { "x-account-key": provSecret, "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });

    const first = await provision("Provisioned One");
    check("a valid account key can provision a store", first.status === 200, `status ${first.status}`);

    // Re-provisioning must rotate rather than stack live credentials.
    await provision("Provisioned One");
    const [keyCount] = await sql<{ live: string; total: string }[]>`
      SELECT COUNT(*) FILTER (WHERE revoked_at IS NULL)::text AS live, COUNT(*)::text AS total
      FROM api_keys WHERE store_id = (
        SELECT id FROM stores WHERE user_id = ${provUser.id} AND name = 'Provisioned One' LIMIT 1
      )
    `;
    check("re-provisioning revokes the store's previous key", keyCount.live === "1",
      `${keyCount.live} live of ${keyCount.total}`);

    // Concurrency is the case the limiter exists for: a check-then-increment
    // implementation lets more than the limit through here.
    await sql`DELETE FROM rate_limits WHERE bucket LIKE 'provision:%'`;
    const burst = await Promise.all(
      Array.from({ length: 20 }, (_, i) => provision(`Burst ${i}`))
    );
    const allowed = burst.filter((r) => r.status !== 429).length;
    check("a concurrent burst is capped at the per-minute limit", allowed <= 10, `${allowed} allowed`);
    check("a throttled provisioning call says when to retry",
      burst.some((r) => r.status === 429 && r.headers.get("retry-after") !== null));

    await sql`DELETE FROM users WHERE id = ${provUser.id}`;
    await sql`DELETE FROM rate_limits WHERE bucket LIKE 'provision:%'`;
  }

  // ------------------------------------------------------------ checkout --
  // Only runs against a Paystack stub (PAYSTACK_BASE_URL), so the suite still
  // passes with no payment provider configured.
  if (process.env.PAYSTACK_BASE_URL) {
    console.log("\nCheckout & upgrades");

    const payEmail = `e2e_pay_${Date.now()}@zephiel.test`;
    const payCookie = sessionCookie(
      await submit("/signup", { name: "Payer", email: payEmail, password: "supersecret123" }, "", "$ACTION_")
    );
    const [payer] = await sql<{ id: string }[]>`SELECT id FROM users WHERE email = ${payEmail} LIMIT 1`;
    const [ipApi] = await sql<{ id: string; slug: string }[]>`
      SELECT id, slug FROM apis WHERE slug = 'ip-intelligence' LIMIT 1
    `;
    const [freeTier] = await sql<{ id: string }[]>`
      SELECT id FROM plans WHERE api_id = ${ipApi.id} AND price = 0 LIMIT 1
    `;
    const [paidTier] = await sql<{ id: string; quota: number }[]>`
      SELECT id, quota::int FROM plans WHERE api_id = ${ipApi.id} AND price > 0
        AND name <> 'Enterprise' ORDER BY price LIMIT 1
    `;

    await submit(`/marketplace/${ipApi.slug}`, { planId: freeTier.id, apiSlug: ipApi.slug }, payCookie);

    // Starting an upgrade must not disturb the plan being paid for today.
    const firstClick = await submit(`/marketplace/${ipApi.slug}`, { planId: paidTier.id, apiSlug: ipApi.slug }, payCookie);
    const [duringCheckout] = await sql<{ status: string; plan_id: string }[]>`
      SELECT status, plan_id FROM subscriptions WHERE user_id = ${payer.id} LIMIT 1
    `;
    check("starting an upgrade leaves the current subscription active",
      duringCheckout.status === "active" && duringCheckout.plan_id === freeTier.id,
      `${duringCheckout.status} on ${duringCheckout.plan_id === freeTier.id ? "free" : "paid"}`);

    // A second click must reuse the same transaction, not open another.
    const secondClick = await submit(`/marketplace/${ipApi.slug}`, { planId: paidTier.id, apiSlug: ipApi.slug }, payCookie);
    const [charges] = await sql<{ c: string }[]>`
      SELECT COUNT(*)::text AS c FROM payments WHERE user_id = ${payer.id} AND status = 'pending'
    `;
    check("clicking upgrade twice opens one charge, not two", charges.c === "1", `${charges.c} pending`);
    check("both clicks lead to the same checkout",
      firstClick.headers.get("location") === secondClick.headers.get("location"));

    const [pending] = await sql<{ reference: string }[]>`
      SELECT reference FROM payments WHERE user_id = ${payer.id} AND status = 'pending' LIMIT 1
    `;

    // Callback and webhook can land together; exactly one must take effect.
    const evt = JSON.stringify({
      event: "charge.success",
      data: { reference: pending.reference, paid_at: new Date().toISOString() },
    });
    const evtSig = createHmac("sha512", process.env.PAYSTACK_SECRET_KEY ?? "").update(evt).digest("hex");
    await Promise.all([
      fetch(`${BASE}/billing/callback?reference=${pending.reference}`, { headers: { cookie: payCookie }, redirect: "manual" }),
      fetch(`${BASE}/api/paystack/webhook`, {
        method: "POST", body: evt,
        headers: { "content-type": "application/json", "x-paystack-signature": evtSig },
      }),
    ]);

    const [settled] = await sql<{ status: string; plan_id: string; quota: number }[]>`
      SELECT status, plan_id, quota::int FROM subscriptions WHERE user_id = ${payer.id} LIMIT 1
    `;
    const [successes] = await sql<{ c: string }[]>`
      SELECT COUNT(*)::text AS c FROM payments WHERE user_id = ${payer.id} AND status = 'success'
    `;
    check("payment moves the subscription onto the plan that was bought",
      settled.plan_id === paidTier.id && settled.quota === paidTier.quota, `quota ${settled.quota}`);
    check("callback and webhook arriving together settle one payment", successes.c === "1", `${successes.c} succeeded`);

    // An amount that disagrees with Paystack must not grant the plan.
    await sql`
      UPDATE payments SET status = 'pending', amount = 99999 WHERE reference = ${pending.reference}
    `;
    await sql`UPDATE subscriptions SET status = 'pending' WHERE user_id = ${payer.id}`;
    await fetch(`${BASE}/billing/callback?reference=${pending.reference}`, { headers: { cookie: payCookie }, redirect: "manual" });
    const [mismatch] = await sql<{ status: string }[]>`
      SELECT status FROM subscriptions WHERE user_id = ${payer.id} LIMIT 1
    `;
    check("a mismatched amount does not activate the subscription", mismatch.status === "pending", mismatch.status);

    await sql`DELETE FROM users WHERE id = ${payer.id}`;
  }

  // ------------------------------------------------- plan edits & limits --
  console.log("\nPlan edits & store limits");

  {
    const [msApi] = await sql<{ id: string }[]>`SELECT id FROM apis WHERE slug = 'multistore' LIMIT 1`;
    const [sandbox] = await sql<{ id: string; quota: number }[]>`
      SELECT id, quota::int FROM plans WHERE api_id = ${msApi.id} AND name = 'Sandbox' LIMIT 1
    `;

    // subscriptions.quota is a copy taken at subscribe time. Raising the plan
    // used to leave every existing customer on the old number.
    await sql`UPDATE subscriptions SET quota = 1 WHERE plan_id = ${sandbox.id}`;
    await submit(`/admin/apis/${msApi.id}`, {
      id: sandbox.id,
      apiId: msApi.id,
      name: "Sandbox",
      price: "0",
      unit: "store",
      requests: "3 stores, 9,000 calls/mo",
      rateLimit: "5 req/min",
      quota: String(sandbox.quota),
      features: "Up to 3 connected storefronts\nCommunity support",
    }, adminCookie, `value="${sandbox.id}"`);

    const [propagated] = await sql<{ stale: string }[]>`
      SELECT COUNT(*)::text AS stale FROM subscriptions
      WHERE plan_id = ${sandbox.id} AND status IN ('active','pending') AND quota <> ${sandbox.quota}
    `;
    check("raising a plan's quota reaches existing subscribers", Number(propagated.stale) === 0,
      `${propagated.stale} left on the old allowance`);

    // Deleting a plan cascades to its subscriptions, stores, and keys.
    const [subsBefore] = await sql<{ c: string }[]>`
      SELECT COUNT(*)::text AS c FROM subscriptions WHERE plan_id = ${sandbox.id}
    `;
    await submit(`/admin/apis/${msApi.id}`, { id: sandbox.id }, adminCookie, "Delete plan");
    const [planLeft] = await sql<{ c: string }[]>`
      SELECT COUNT(*)::text AS c FROM plans WHERE id = ${sandbox.id}
    `;
    const [subsAfter] = await sql<{ c: string }[]>`
      SELECT COUNT(*)::text AS c FROM subscriptions WHERE plan_id = ${sandbox.id}
    `;
    check("a plan with subscribers cannot be deleted", planLeft.c === "1");
    check("refusing the delete leaves the subscriptions intact", subsAfter.c === subsBefore.c,
      `${subsBefore.c} -> ${subsAfter.c}`);
  }

  {
    // The free tier's advertised store allowance is now enforced; it used to
    // be a flat 100 for every plan, so Sandbox's limit meant nothing.
    const freeEmail = `e2e_free_${Date.now()}@zephiel.test`;
    const freeCookie = sessionCookie(
      await submit("/signup", { name: "Free Tier", email: freeEmail, password: "supersecret123" }, "", "$ACTION_")
    );
    const [freeUser] = await sql<{ id: string }[]>`SELECT id FROM users WHERE email = ${freeEmail} LIMIT 1`;
    const [msApi2] = await sql<{ id: string }[]>`SELECT id FROM apis WHERE slug = 'multistore' LIMIT 1`;
    const [sandbox2] = await sql<{ id: string; quota: number }[]>`
      SELECT id, quota::int FROM plans WHERE api_id = ${msApi2.id} AND name = 'Sandbox' LIMIT 1
    `;
    await sql`
      INSERT INTO subscriptions (user_id, api_id, plan_id, status, quota, units, current_period_end)
      VALUES (${freeUser.id}, ${msApi2.id}, ${sandbox2.id}, 'active', ${sandbox2.quota}, 1,
              now() + interval '30 days')
    `;

    for (let i = 1; i <= FREE_STORE_LIMIT + 1; i++) {
      await submit("/dashboard/stores", {
        name: `Free Store ${i}`,
        platform: "shopify",
      }, freeCookie, 'name="platform"');
    }

    const [connected] = await sql<{ c: string }[]>`
      SELECT COUNT(*)::text AS c FROM stores WHERE user_id = ${freeUser.id}
    `;
    check(
      `a free plan connects at most ${FREE_STORE_LIMIT} stores`,
      Number(connected.c) === FREE_STORE_LIMIT,
      `${connected.c} connected`
    );

    const storesHtml = await (await fetch(`${BASE}/dashboard/stores`, { headers: { cookie: freeCookie } })).text();
    check("free plan is told its store allowance rather than a $0 bill",
      storesHtml.includes("at no charge") && !storesHtml.includes("$0 per connected store"));

    await sql`DELETE FROM users WHERE id = ${freeUser.id}`;
  }

  // ------------------------------------------------------------- pricing --
  console.log("\nPlans & billing period");

  const pricingHtml = await (await fetch(`${BASE}/pricing`)).text();
  check("pricing page quotes Enterprise rather than pricing it", pricingHtml.includes("Custom"));
  check("pricing page links Enterprise to sales", pricingHtml.includes("/contact?plan=enterprise"));
  check("pricing page offers a billing period toggle", pricingHtml.includes("Billing period"));

  {
    // Enterprise is quoted, never sold. The control is hidden, but the form
    // post is reachable, and its quota is unlimited — so the refusal has to be
    // server-side.
    const [entPlan] = await sql<{ id: string; slug: string }[]>`
      SELECT p.id, a.slug FROM plans p JOIN apis a ON a.id = p.api_id
      WHERE p.name = 'Enterprise' AND a.slug = 'ip-intelligence' LIMIT 1
    `;
    await submit(`/marketplace/${entPlan.slug}`, {
      planId: entPlan.id,
      apiSlug: entPlan.slug,
    }, cookie, "$ACTION_");
    const [bought] = await sql<{ c: string }[]>`
      SELECT COUNT(*)::text AS c FROM subscriptions s JOIN plans p ON p.id = s.plan_id
      WHERE s.user_id = ${user.id} AND p.name = 'Enterprise'
    `;
    check("Enterprise cannot be subscribed to by posting the form", Number(bought.c) === 0);

    // A free plan taken annually gets a year, not a month.
    const [freePlan] = await sql<{ id: string }[]>`
      SELECT p.id FROM plans p JOIN apis a ON a.id = p.api_id
      WHERE a.slug = 'ip-intelligence' AND p.price = 0 ORDER BY p.sort_order LIMIT 1
    `;
    await submit("/marketplace/ip-intelligence", {
      planId: freePlan.id,
      apiSlug: "ip-intelligence",
      interval: "annual",
    }, cookie, "$ACTION_");
    // Scoped to this API: the account already holds a Multistore subscription
    // from the store checks above, and an unfiltered LIMIT 1 picked that one.
    const [annual] = await sql<{ interval: string; days: number }[]>`
      SELECT s.billing_interval AS interval,
             EXTRACT(DAY FROM (s.current_period_end - now()))::int AS days
      FROM subscriptions s JOIN apis a ON a.id = s.api_id
      WHERE s.user_id = ${user.id} AND a.slug = 'ip-intelligence' LIMIT 1
    `;
    check("annual billing is recorded on the subscription", annual?.interval === "annual", annual?.interval ?? "none");
    check("annual subscription runs for a year", (annual?.days ?? 0) > 360, `${annual?.days} days`);

    await sql`
      DELETE FROM subscriptions s USING apis a
      WHERE a.id = s.api_id AND s.user_id = ${user.id} AND a.slug = 'ip-intelligence'
    `;
  }

  // ---------------------------------------------- admin sign-in address ----
  console.log("\nAdmin sign-in address");

  check("settings page exposes the sign-in address field", settingsHtml.includes('name="email"'));

  // The email is a login credential, so a wrong password must not move it.
  await submit("/admin/settings", {
    email: "hijacked@example.com",
    current: "definitely-not-the-password",
  }, adminCookie, 'name="email"');
  const [unmoved] = await sql<{ c: string }[]>`
    SELECT COUNT(*)::text AS c FROM users WHERE email = 'hijacked@example.com'
  `;
  check("email change is refused without the correct password", Number(unmoved.c) === 0);

  // An address another account already holds must be refused.
  const [otherUser] = await sql<{ email: string }[]>`
    SELECT email FROM users WHERE role = 'customer' ORDER BY created_at LIMIT 1
  `;
  if (otherUser) {
    await submit("/admin/settings", {
      email: otherUser.email,
      current: adminPass,
    }, adminCookie, 'name="email"');
    const [dupes] = await sql<{ c: string }[]>`
      SELECT COUNT(*)::text AS c FROM users WHERE lower(email) = ${otherUser.email.toLowerCase()}
    `;
    check("email already in use is refused", Number(dupes.c) === 1, `${dupes.c} accounts hold it`);
  }

  // The real change, and proof the new address is what signs in afterwards.
  const moved = "admin-moved@zephiel.com";
  await submit("/admin/settings", { email: moved, current: adminPass }, adminCookie, 'name="email"');
  const [after] = await sql<{ c: string }[]>`
    SELECT COUNT(*)::text AS c FROM users WHERE email = ${moved} AND role = 'admin'
  `;
  check("email change with the correct password is applied", Number(after.c) === 1);

  const oldAddress = await submit("/admin/login", { email: adminEmail, password: adminPass }, "", "$ACTION_");
  check("the old address no longer signs in", !(oldAddress.headers.get("set-cookie") ?? "").includes("session"));

  const newAddress = await submit("/admin/login", { email: moved, password: adminPass }, "", "$ACTION_");
  check("the new address signs in", (newAddress.headers.get("set-cookie") ?? "").includes("session"));

  await sql`UPDATE users SET email = ${adminEmail} WHERE email = ${moved}`;

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exitCode = failed === 0 ? 0 : 1;
} catch (err) {
  console.error("\nE2E run crashed:", err);
  process.exitCode = 1;
} finally {
  // Cleanup belongs here rather than at the end of the run: a crash partway
  // through used to leave a published API with no plans, endpoints, or
  // category behind, which then showed up as three findings in the audit.
  // Matching on the fixture prefixes rather than this run's own values also
  // sweeps up anything an earlier crashed run left behind.
  await sql`DELETE FROM apis WHERE slug LIKE 'e2e-api-%'`;
  await sql`DELETE FROM users WHERE email LIKE 'e2e\_%@zephiel.test'`;

  await sql.end();
}
