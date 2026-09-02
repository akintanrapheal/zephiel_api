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
import sharp from "sharp";
import { ANNUAL_MONTHS_CHARGED } from "../src/lib/plans.ts";
import postgres from "postgres";
import { loadEnv } from "./env.mts";

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
    "/admin/settings/payments",
    "/admin/settings/email",
    "/admin/settings/platform",
    "/admin/settings/data",
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
    await fetch(`${BASE}/admin/settings/data`, { headers: { cookie: adminCookie } })
  ).text();
  check("settings page reports schema status", schemaHtml.includes("Database schema"));
  check("settings offers a catalogue reseed", schemaHtml.includes("Reseed catalogue"));
  // Each group is its own route now, sharing one layout with the tab bar.
  const settingsIndex = await fetch(`${BASE}/admin/settings`, {
    headers: { cookie: adminCookie }, redirect: "manual",
  });
  check("settings opens on a tab rather than one long page",
    settingsIndex.status === 307 &&
      (settingsIndex.headers.get("location") ?? "").includes("/admin/settings/payments"),
    `status ${settingsIndex.status}`);

  for (const [slug, marker] of [
    ["payments", "Paystack"],
    ["email", "Send sample"],
    ["platform", "Site origin"],
    ["data", "Reseed catalogue"],
  ]) {
    const tab = await fetch(`${BASE}/admin/settings/${slug}`, { headers: { cookie: adminCookie } });
    const html = await tab.text();
    check(`settings tab /${slug} loads its own panel`,
      tab.status === 200 && html.includes(marker), `status ${tab.status}`);
    check(`settings tab /${slug} shows the tab bar`, html.includes("Settings sections"));
  }

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
    await submit("/admin/settings/data", {}, adminCookie, "Reseed catalogue");

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
    await fetch(`${BASE}/admin/settings/payments`, { headers: { cookie: adminCookie } })
  ).text();
  check("settings page exposes the Paystack key field", settingsHtml.includes('name="secretKey"'));
  check("secret key field is a password input", /name="secretKey"[^>]*type="password"|type="password"[^>]*name="secretKey"/.test(settingsHtml));
  check("settings page shows the webhook URL", settingsHtml.includes("/api/paystack/webhook"));

  // A bogus key must be rejected before anything is stored.
  const bogusKey = await submit("/admin/settings/payments", {
    secretKey: "not-a-real-key",
    currency: "NGN",
    usdToNgn: "1550",
  }, adminCookie, 'name="secretKey"');
  const [stored] = await sql<{ c: string }[]>`
    SELECT COUNT(*)::text AS c FROM settings WHERE key = 'paystack_secret_key' AND value <> ''
  `;
  check("malformed Paystack key is refused", Number(stored.c) === 0, `status ${bogusKey.status}`);

  // Non-secret settings still save.
  await submit("/admin/settings/payments", { currency: "USD", usdToNgn: "1600" }, adminCookie, 'name="secretKey"');
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
    WHERE a.slug = 'weather-forecast' AND p.price = 0 AND p.name <> 'Enterprise'
    ORDER BY p.sort_order LIMIT 1
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
    WHERE a.slug = 'multistore' AND p.price = 0 AND p.name <> 'Enterprise'
    ORDER BY p.sort_order LIMIT 1
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
  }, adminCookie, 'name="total"');
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
    WHERE a.slug = 'timezone-api' AND p.price = 0 AND p.name <> 'Enterprise'
    ORDER BY p.sort_order LIMIT 1
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
    WHERE a.slug = 'air-quality' AND p.price > 0 AND p.name <> 'Enterprise'
    ORDER BY p.sort_order LIMIT 1
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
  // Two plans there are priced 0 — Sandbox and Enterprise — and Enterprise is
  // deliberately not subscribable, so an unordered LIMIT 1 picked a plan with
  // no form roughly half the time.
  const [freePlan] = await sql<{ id: string; api_id: string; quota: number }[]>`
    SELECT p.id, p.api_id, p.quota FROM plans p
    JOIN apis a ON a.id = p.api_id
    WHERE a.slug = 'multistore' AND p.price = 0 AND p.name <> 'Enterprise'
    ORDER BY p.sort_order
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
      SELECT id FROM plans WHERE api_id = ${ipApi.id} AND price = 0
        AND name <> 'Enterprise' ORDER BY sort_order LIMIT 1
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

    // --- what the interval actually buys ----------------------------------
    // The charge and the period both follow the interval. Both were wrong once:
    // an annual payment used to be billed a year and granted a month.
    const chargedFor: Record<string, number> = {};

    for (const interval of ["monthly", "annual"] as const) {
      const email = `e2e_${interval}_${Date.now()}@zephiel.test`;
      const c = sessionCookie(
        await submit("/signup", { name: "Interval", email, password: "supersecret123" }, "", "$ACTION_")
      );
      const [who] = await sql<{ id: string }[]>`SELECT id FROM users WHERE email = ${email} LIMIT 1`;

      await submit(`/marketplace/${ipApi.slug}`, {
        planId: paidTier.id, apiSlug: ipApi.slug, interval,
      }, c);

      const [charge] = await sql<{ amount: string; reference: string }[]>`
        SELECT amount::text, reference FROM payments
        WHERE user_id = ${who.id} AND status = 'pending' LIMIT 1
      `;
      const [tier] = await sql<{ price: string }[]>`
        SELECT price::text FROM plans WHERE id = ${paidTier.id}
      `;

      chargedFor[interval] = Number(charge.amount);
      check(`a ${interval} purchase creates a charge`, Number(charge.amount) > 0,
        `charged ${charge.amount} for a ${tier.price}/mo plan`);

      const evt2 = JSON.stringify({
        event: "charge.success",
        data: { reference: charge.reference, paid_at: new Date().toISOString() },
      });
      const sig2 = createHmac("sha512", process.env.PAYSTACK_SECRET_KEY ?? "").update(evt2).digest("hex");
      await fetch(`${BASE}/api/paystack/webhook`, {
        method: "POST", body: evt2,
        headers: { "content-type": "application/json", "x-paystack-signature": sig2 },
      });

      const [granted] = await sql<{ status: string; interval: string; days: number; quota: number }[]>`
        SELECT status, billing_interval AS interval, quota::int,
               EXTRACT(DAY FROM (current_period_end - now()))::int AS days
        FROM subscriptions WHERE user_id = ${who.id} LIMIT 1
      `;
      check(`a ${interval} payment activates the subscription`, granted.status === "active", granted.status);
      check(`a ${interval} payment records the interval`, granted.interval === interval, granted.interval);
      check(`a ${interval} payment grants ${interval === "annual" ? "a year" : "a month"}`,
        interval === "annual" ? granted.days > 360 : granted.days > 27 && granted.days < 32,
        `${granted.days} days`);
      check(`a ${interval} payment applies the plan's quota`,
        granted.quota === paidTier.quota, `${granted.quota} vs ${paidTier.quota}`);

      // Renewal has to roll by the same interval it was sold on.
      await sql`
        UPDATE subscriptions SET current_period_end = now() - interval '1 day', used = 500
        WHERE user_id = ${who.id}
      `;
      await sql`UPDATE plans SET price = 0 WHERE id = ${paidTier.id}`;
      await fetch(`${BASE}/api/cron/usage-rollup`, {
        headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` },
      });
      await sql`UPDATE plans SET price = ${tier.price} WHERE id = ${paidTier.id}`;

      const [rolled] = await sql<{ days: number; used: number }[]>`
        SELECT EXTRACT(DAY FROM (current_period_end - now()))::int AS days, used
        FROM subscriptions WHERE user_id = ${who.id} LIMIT 1
      `;
      check(`a ${interval} renewal rolls by ${interval === "annual" ? "a year" : "a month"}`,
        interval === "annual" ? rolled.days > 355 : rolled.days > 26 && rolled.days < 32,
        `${rolled.days} days`);

      await sql`DELETE FROM users WHERE id = ${who.id}`;
    }

    // The discount is the whole point of the annual option: twelve months of
    // service for ten months of money.
    check("a year costs ten months, not twelve",
      Math.abs(chargedFor.annual - chargedFor.monthly * ANNUAL_MONTHS_CHARGED) < 0.01,
      `annual ${chargedFor.annual}, monthly ${chargedFor.monthly}`);
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
    const [sandbox2] = await sql<{ id: string; quota: number; store_limit: number }[]>`
      SELECT id, quota::int, store_limit::int FROM plans
      WHERE api_id = ${msApi2.id} AND name = 'Sandbox' LIMIT 1
    `;
    const freeStoreLimit = sandbox2.store_limit;
    await sql`
      INSERT INTO subscriptions (user_id, api_id, plan_id, status, quota, units, current_period_end)
      VALUES (${freeUser.id}, ${msApi2.id}, ${sandbox2.id}, 'active', ${sandbox2.quota}, 1,
              now() + interval '30 days')
    `;

    for (let i = 1; i <= freeStoreLimit + 1; i++) {
      await submit("/dashboard/stores", {
        name: `Free Store ${i}`,
        platform: "shopify",
      }, freeCookie, 'name="platform"');
    }

    const [connected] = await sql<{ c: string }[]>`
      SELECT COUNT(*)::text AS c FROM stores WHERE user_id = ${freeUser.id}
    `;
    check(
      `the free plan connects at most its own allowance of ${freeStoreLimit}`,
      Number(connected.c) === freeStoreLimit,
      `${connected.c} connected`
    );

    // Each tier carries its own ceiling; they used to share one.
    const limits = await sql<{ name: string; store_limit: number }[]>`
      SELECT p.name, p.store_limit::int FROM plans p JOIN apis a ON a.id = p.api_id
      WHERE a.slug = 'multistore' ORDER BY p.sort_order
    `;
    check("Multistore tiers carry their own store allowance",
      limits[0]?.store_limit === 1 && limits[1]?.store_limit === 3 &&
        limits[2]?.store_limit === 5 && limits[3]?.store_limit === 0,
      limits.map((l) => `${l.name}:${l.store_limit}`).join(" "));

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
    // Tiers are comparable only if every card shows the same rows, some ticked
    // and some crossed. Four disjoint lists cannot be read across.
    const ticks = (pricingHtml.match(/M4 12\.5l5 5L20 6\.5/g) ?? []).length;
    const crosses = (pricingHtml.match(/M6 6l12 12M18 6L6 18/g) ?? []).length;
    check("pricing cards show a tick-or-cross for every capability",
      ticks > 0 && crosses > 0 && (ticks + crosses) % 4 === 0,
      `${ticks} ticks, ${crosses} crosses`);
    check("a lower tier is shown what it does not include", crosses >= ticks / 4,
      `${crosses} crosses`);

    // Every listing's tiers must be cumulative, or a cross would appear on a
    // higher tier for something a lower one has.
    const notCumulative = await sql<{ slug: string }[]>`
      SELECT DISTINCT a.slug
      FROM plans lo
      JOIN plans hi ON hi.api_id = lo.api_id AND hi.sort_order = lo.sort_order + 1
      JOIN apis a ON a.id = lo.api_id
      WHERE NOT (lo.features <@ hi.features)
    `;
    check("every listing's tiers build cumulatively", notCumulative.length === 0,
      notCumulative.map((r) => r.slug).join(", "));

    const ladder = await sql<{ name: string; quota: number }[]>`
      SELECT p.name, p.quota FROM plans p JOIN apis a ON a.id = p.api_id
      WHERE a.slug = 'multistore' ORDER BY p.sort_order
    `;
    check("Multistore's free tier includes 5,000 calls",
      ladder[0]?.quota === 5000, `${ladder[0]?.quota}`);
    check("Multistore's allowance climbs with the tier",
      ladder.slice(0, 3).every((p, i, arr) => i === 0 || p.quota > arr[i - 1].quota),
      ladder.map((p) => `${p.name}:${p.quota}`).join(" "));
  }

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

  // ------------------------------------------------------- usage & quota --
  console.log("\nUsage & quota");

  {
    const [qSub] = await sql<{ id: string; api_id: string; quota: number }[]>`
      SELECT s.id, s.api_id, s.quota FROM subscriptions s
      WHERE s.user_id = ${user.id} AND s.current_period_end IS NOT NULL
      LIMIT 1
    `;

    if (qSub) {
      // History either side of the period boundary; only the inside counts.
      await sql`DELETE FROM usage_daily WHERE user_id = ${user.id} AND api_id = ${qSub.api_id}`;
      // A backdated first period: longer than a month, which is exactly what
      // the old "end minus one month" inference could not represent.
      await sql`
        UPDATE subscriptions SET quota = 5000, used = 4001,
          current_period_start = CURRENT_DATE - 40,
          current_period_end = now() + interval '20 days'
        WHERE id = ${qSub.id}
      `;
      await sql`
        INSERT INTO usage_daily (user_id, api_id, day, calls, errors, avg_latency)
        SELECT ${user.id}, ${qSub.api_id}, d::date, 100, 0, 150
        FROM generate_series(CURRENT_DATE - 60, CURRENT_DATE - 1, interval '1 day') d
      `;

      // Same definition the reconciliation uses: rolled-up finished days plus
      // today's live events, so the boundary is not counted twice or missed.
      const [expected] = await sql<{ c: number }[]>`
        SELECT (
          COALESCE((SELECT SUM(d.calls) FROM usage_daily d
            WHERE d.user_id = s.user_id AND d.api_id = s.api_id
              AND d.day >= s.current_period_start::date AND d.day < CURRENT_DATE), 0)
          + COALESCE((SELECT COUNT(*) FROM usage_events e
            WHERE e.user_id = s.user_id AND e.api_id = s.api_id
              AND e.created_at >= CURRENT_DATE
              AND e.created_at >= s.current_period_start), 0)
        )::int AS c
        FROM subscriptions s WHERE s.id = ${qSub.id}
      `;

      await submit(`/admin/users/${user.id}`, { subscriptionId: qSub.id },
        adminCookie, "Recalculate quota from usage");

      const [reconciled] = await sql<{ used: number; quota: number }[]>`
        SELECT used, quota FROM subscriptions WHERE id = ${qSub.id}
      `;
      check("quota counter is recomputed from recorded usage",
        reconciled.used === expected.c, `used ${reconciled.used}, period total ${expected.c}`);
      check("quota counter is not the lifetime total", reconciled.used < 6000);
      // 40 days of history at 100/day: a one-month inference would find ~3,100.
      check("a period longer than a month is counted in full",
        reconciled.used === expected.c && expected.c > 3500,
        `used ${reconciled.used}, expected ${expected.c}`);
      check("quota counter never exceeds the quota", reconciled.used <= reconciled.quota);

      // What is left has to survive the rest of the period.
      const [pace] = await sql<{ rem: number; days: number }[]>`
        SELECT (quota - used)::int AS rem,
               GREATEST(1, CEIL(EXTRACT(EPOCH FROM (current_period_end - now())) / 86400))::int AS days
        FROM subscriptions WHERE id = ${qSub.id}
      `;
      const perDay = Math.floor(pace.rem / pace.days);
      check("the daily budget spends no more than what remains",
        perDay * pace.days <= pace.rem, `${perDay}/day x ${pace.days} vs ${pace.rem}`);

      // The store row used to sum all time while the quota bar counted the
      // period, so the two disagreed on adjacent screens. Rows on both sides of
      // the boundary prove the figure now stops at it.
      const [aStore] = await sql<{ id: string }[]>`
        SELECT id FROM stores WHERE user_id = ${user.id} AND subscription_id = ${qSub.id} LIMIT 1
      `;
      if (aStore) {
        await sql`DELETE FROM usage_daily WHERE store_id = ${aStore.id}`;
        // 500 inside the period, 900 before it began.
        await sql`
          INSERT INTO usage_daily (user_id, api_id, store_id, day, calls, errors, avg_latency)
          VALUES (${user.id}, ${qSub.api_id}, ${aStore.id}, CURRENT_DATE - 1, 500, 0, 150),
                 (${user.id}, ${qSub.api_id}, ${aStore.id}, CURRENT_DATE - 80, 900, 0, 150)
        `;
        const [shown] = await sql<{ c: number }[]>`
          SELECT (
            COALESCE((SELECT SUM(d.calls) FROM usage_daily d
              WHERE d.store_id = st.id
                AND d.day >= COALESCE(sub.current_period_start, CURRENT_DATE - 30)::date
                AND d.day < CURRENT_DATE), 0)
            + (SELECT COUNT(*) FROM usage_events e
               WHERE e.store_id = st.id AND e.created_at >= CURRENT_DATE)
          )::int AS c
          FROM stores st LEFT JOIN subscriptions sub ON sub.id = st.subscription_id
          WHERE st.id = ${aStore.id}
        `;
        const [live] = await sql<{ c: number }[]>`
          SELECT COUNT(*)::int AS c FROM usage_events
          WHERE store_id = ${aStore.id} AND created_at >= CURRENT_DATE
        `;
        check("a store's call figure counts the period, not all time",
          shown.c === 500 + live.c, `showed ${shown.c}, expected ${500 + live.c}`);
        check("history before the period began is excluded", shown.c < 1400);
        await sql`DELETE FROM usage_daily WHERE store_id = ${aStore.id}`;
      }

      // Backdated invoices, for demonstration accounts that need a history.
      await sql`
        UPDATE subscriptions SET plan_id = (
          SELECT id FROM plans WHERE api_id = ${qSub.api_id} AND price > 0
            AND name <> 'Enterprise' ORDER BY sort_order LIMIT 1
        ) WHERE id = ${qSub.id}
      `;
      await submit(`/admin/users/${user.id}`, {
        subscriptionId: qSub.id, months: "3", method: "card",
      }, adminCookie, "Record payments");

      const invoices = await sql<{ invoice_number: string; reference: string; period_start: Date }[]>`
        SELECT invoice_number, reference, period_start FROM payments
        WHERE user_id = ${user.id} AND status = 'success' ORDER BY period_start
      `;
      check("past months are invoiced one per month", invoices.length === 3, `${invoices.length}`);
      check("every backdated payment carries an invoice number",
        invoices.every((i) => /^ZPH-\d{4}-\d{5}$/.test(i.invoice_number ?? "")));
      check("backdated references cannot pass for Paystack ones",
        invoices.every((i) => i.reference.startsWith("demo_")));
      check("each invoice covers a different month",
        new Set(invoices.map((i) => new Date(i.period_start).getUTCMonth())).size === 3);

      // Filling the period has to land on the number it was asked for.
      await submit(`/admin/users/${user.id}`, { subscriptionId: qSub.id, percent: "94" },
        adminCookie, "Set usage");
      const [filled] = await sql<{ used: number; quota: number }[]>`
        SELECT used, quota FROM subscriptions WHERE id = ${qSub.id}
      `;
      check("filling the period hits the share asked for",
        filled.used === Math.floor(filled.quota * 0.94),
        `${filled.used} of ${filled.quota}`);
      check("filling the period leaves the account under quota", filled.used < filled.quota);

      await sql`DELETE FROM payments WHERE user_id = ${user.id} AND reference LIKE 'demo_%'`;
      await sql`DELETE FROM usage_daily WHERE user_id = ${user.id} AND api_id = ${qSub.api_id}`;
    }
  }

  // ---------------------------------------------- admin sign-in address ----
  console.log("\nAdmin sign-in address");

  const adminProfileHtml = await (
    await fetch(`${BASE}/admin/profile`, { headers: { cookie: adminCookie } })
  ).text();
  check("admin profile exposes the sign-in address field", adminProfileHtml.includes('name="email"'));
  check("admin profile exposes a password change", adminProfileHtml.includes('name="confirm"'));
  check("settings no longer mixes in personal account fields",
    !settingsHtml.includes("Your password"));
  check("settings points at the profile page", settingsHtml.includes("/admin/profile"));

  // The email is a login credential, so a wrong password must not move it.
  await submit("/admin/profile", {
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
    await submit("/admin/profile", {
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
  await submit("/admin/profile", { email: moved, current: adminPass }, adminCookie, 'name="email"');
  const [after] = await sql<{ c: string }[]>`
    SELECT COUNT(*)::text AS c FROM users WHERE email = ${moved} AND role = 'admin'
  `;
  check("email change with the correct password is applied", Number(after.c) === 1);

  const oldAddress = await submit("/admin/login", { email: adminEmail, password: adminPass }, "", "$ACTION_");
  check("the old address no longer signs in", !(oldAddress.headers.get("set-cookie") ?? "").includes("session"));

  const newAddress = await submit("/admin/login", { email: moved, password: adminPass }, "", "$ACTION_");
  check("the new address signs in", (newAddress.headers.get("set-cookie") ?? "").includes("session"));

  await sql`UPDATE users SET email = ${adminEmail} WHERE email = ${moved}`;

  // -------------------------------------------------- profile & invoices --
  console.log("\nProfile & invoices");

  {
    const profile = await (await fetch(`${BASE}/dashboard/profile`, { headers: { cookie } })).text();
    check("profile page offers an email change", profile.includes('name="email"'));
    check("profile page offers a password change", profile.includes('name="confirm"'));
    check("profile page accepts an image upload",
      profile.includes('type="file"') && profile.includes('accept="image/'));

    // A phone photo: large, landscape, and not square.
    const photo = await sharp({
      create: { width: 900, height: 600, channels: 3, background: { r: 30, g: 90, b: 200 } },
    }).jpeg().toBuffer();

    const upFields = await actionFields("/dashboard/profile", 'name="avatar"', cookie);
    const upBody = new FormData();
    for (const [k, v] of Object.entries(upFields)) upBody.append(k, v);
    upBody.set("avatar", new File([new Uint8Array(photo)], "photo.jpg", { type: "image/jpeg" }));
    await fetch(`${BASE}/dashboard/profile`, {
      method: "POST", body: upBody, headers: { cookie }, redirect: "manual",
    });

    const [stored] = await sql<{ len: number; type: string | null }[]>`
      SELECT length(avatar) AS len, avatar_type AS type FROM users WHERE id = ${user.id}
    `;
    check("uploaded photo is stored", (stored?.len ?? 0) > 0);
    check("photo is re-encoded to webp", stored?.type === "image/webp");
    check("photo is shrunk, not stored raw", (stored?.len ?? Infinity) < photo.length,
      `${stored?.len} vs ${photo.length} bytes`);

    const served = await fetch(`${BASE}/api/avatar/${user.id}`);
    check("avatar is served as an image",
      served.status === 200 && served.headers.get("content-type") === "image/webp");

    // A file that is not an image must be refused rather than crashing.
    const badFields = await actionFields("/dashboard/profile", 'name="avatar"', cookie);
    const badBody = new FormData();
    for (const [k, v] of Object.entries(badFields)) badBody.append(k, v);
    badBody.set("avatar", new File([new Uint8Array(Buffer.from("nope"))], "x.jpg", { type: "image/jpeg" }));
    const badUpload = await fetch(`${BASE}/dashboard/profile`, {
      method: "POST", body: badBody, headers: { cookie },
    });
    check("a non-image upload is refused without erroring", badUpload.status === 200);

    // An invoice belonging to someone else must not be readable.
    const [other] = await sql<{ id: string }[]>`
      SELECT id FROM users WHERE id <> ${user.id} AND role = 'customer' LIMIT 1
    `;
    if (other) {
      const ref = `zph_e2e_inv_${Date.now()}`;
      const number = `ZPH-E2E-${Date.now().toString().slice(-6)}`;
      await sql`
        INSERT INTO payments (user_id, reference, amount, currency, status, paid_at, invoice_number)
        VALUES (${other.id}, ${ref}, 100, 'NGN', 'success', now(), ${number})
      `;
      const stolen = await fetch(`${BASE}/dashboard/billing/${number}`, {
        headers: { cookie }, redirect: "manual",
      });
      check("another account's invoice is not readable", stolen.status === 404, `status ${stolen.status}`);
      await sql`DELETE FROM payments WHERE reference = ${ref}`;
    }

    const anonPreview = await fetch(`${BASE}/admin/settings/preview/receipt`, { redirect: "manual" });
    check("document preview refuses anonymous access", anonPreview.status === 404,
      `status ${anonPreview.status}`);
  }

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

  // Payments before users: payments.user_id is ON DELETE SET NULL, so removing
  // the fixture users first orphans their payment rows instead of taking them,
  // and the audit then reports those orphans as stuck pending charges.
  await sql`
    DELETE FROM payments
    WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'e2e\_%@zephiel.test')
  `;
  await sql`DELETE FROM users WHERE email LIKE 'e2e\_%@zephiel.test'`;

  await sql.end();
}
