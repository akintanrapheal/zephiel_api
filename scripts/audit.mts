/* Crawls the running app as three personas and reports anything broken. */
import postgres from "postgres";
import { loadEnv } from "./env.mts";
loadEnv();

const BASE = process.argv[2] ?? "http://localhost:3110";
const url = process.env.DATABASE_URL!;
const sql = postgres(url, { max: 1, ssl: url.includes("localhost") ? false : "require", onnotice: () => {} });

const unesc = (v: string) => v.replace(/&quot;/g,'"').replace(/&#x27;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&");

async function signIn(path: string, email: string, password: string) {
  const html = await (await fetch(`${BASE}${path}`)).text();
  const form = html.split("<form").slice(1).map(f => f.split("</form>")[0]).find(f => f.includes("$ACTION_"));
  if (!form) return "";
  const fd = new FormData();
  for (const m of form.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
    const n = /name="([^"]*)"/.exec(m[0])?.[1]; const v = /value="([^"]*)"/.exec(m[0])?.[1] ?? "";
    if (n) fd.append(n, unesc(v));
  }
  fd.append("email", email); fd.append("password", password);
  const res = await fetch(`${BASE}${path}`, { method: "POST", body: fd, redirect: "manual" });
  return (/zephiel_session=[^;]+/.exec(res.headers.get("set-cookie") ?? "") ?? [""])[0];
}

const issues: string[] = [];
const note = (s: string) => { issues.push(s); console.log("  ISSUE  " + s); };

// --- personas ---------------------------------------------------------------
const stamp = Date.now();
const custEmail = `audit_${stamp}@zephiel.test`;
{
  const html = await (await fetch(`${BASE}/signup`)).text();
  const form = html.split("<form").slice(1).map(f => f.split("</form>")[0]).find(f => f.includes("$ACTION_"))!;
  const fd = new FormData();
  for (const m of form.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
    const n = /name="([^"]*)"/.exec(m[0])?.[1]; const v = /value="([^"]*)"/.exec(m[0])?.[1] ?? "";
    if (n) fd.append(n, unesc(v));
  }
  fd.append("name","Audit"); fd.append("email",custEmail); fd.append("password","supersecret123");
  await fetch(`${BASE}/signup`, { method:"POST", body:fd, redirect:"manual" });
}
const cust = await signIn("/signin", custEmail, "supersecret123");
const admin = await signIn("/admin/login", process.env.ADMIN_EMAIL ?? "admin@zephiel.dev", process.env.ADMIN_PASSWORD ?? "zephiel-admin");
console.log(`customer session: ${cust ? "ok" : "FAILED"} · admin session: ${admin ? "ok" : "FAILED"}\n`);

// --- crawl -------------------------------------------------------------------
const apis = await sql<{ slug: string }[]>`SELECT slug FROM apis WHERE published LIMIT 3`;
const cats = await sql<{ slug: string }[]>`SELECT slug FROM categories LIMIT 3`;
const [aUser] = await sql<{ id: string }[]>`SELECT id FROM users WHERE email = ${custEmail}`;

const routes: { path: string; cookie: string; label: string }[] = [
  ...["/", "/marketplace", "/categories", "/pricing", "/docs", "/status", "/about", "/providers",
      "/blog", "/contact", "/legal/terms", "/legal/gdpr", "/signin", "/signup", "/robots.txt", "/sitemap.xml"]
    .map(p => ({ path: p, cookie: "", label: "public" })),
  ...apis.map(a => ({ path: `/marketplace/${a.slug}`, cookie: "", label: "public" })),
  ...cats.map(c => ({ path: `/categories/${c.slug}`, cookie: "", label: "public" })),
  ...["/dashboard","/dashboard/stores","/dashboard/usage","/dashboard/billing","/dashboard/keys","/dashboard/playground"]
    .map(p => ({ path: p, cookie: cust, label: "customer" })),
  ...["/admin","/admin/apis","/admin/apis/new","/admin/categories","/admin/users","/admin/subscriptions",
      "/admin/payments","/admin/settings","/admin/notifications", `/admin/users/${aUser.id}`]
    .map(p => ({ path: p, cookie: admin, label: "admin" })),
];

console.log("Crawling routes");
const bodies = new Map<string, string>();
for (const r of routes) {
  const res = await fetch(`${BASE}${r.path}`, { headers: r.cookie ? { cookie: r.cookie } : {}, redirect: "manual" });
  if (res.status !== 200) note(`${r.label} ${r.path} -> ${res.status}`);
  else bodies.set(r.path, await res.text());
}
console.log(`  checked ${routes.length} routes\n`);

// --- internal links ----------------------------------------------------------
console.log("Checking internal links");
const seen = new Set<string>();
for (const [from, html] of bodies) {
  for (const m of html.matchAll(/href="(\/[^"#?]*)"/g)) {
    const href = m[1];
    if (seen.has(href) || href.startsWith("/_next") || href.startsWith("/api/")) continue;
    seen.add(href);
    const cookie = href.startsWith("/admin") ? admin : href.startsWith("/dashboard") ? cust : "";
    const res = await fetch(`${BASE}${href}`, { headers: cookie ? { cookie } : {}, redirect: "manual" });
    if (res.status >= 400) note(`dead link ${href} (from ${from}) -> ${res.status}`);
  }
}
console.log(`  checked ${seen.size} distinct links\n`);

// --- data integrity ----------------------------------------------------------
console.log("Data integrity");
const checks: [string, string][] = [
  ["subscriptions active past their renewal date",
   `SELECT COUNT(*)::text c FROM subscriptions WHERE status='active' AND current_period_end < now()`],
  ["subscriptions over quota still marked active",
   `SELECT COUNT(*)::text c FROM subscriptions WHERE status='active' AND used > quota`],
  ["published APIs with no plans",
   `SELECT COUNT(*)::text c FROM apis a WHERE a.published AND NOT EXISTS (SELECT 1 FROM plans p WHERE p.api_id=a.id)`],
  ["published APIs with no endpoints",
   `SELECT COUNT(*)::text c FROM apis a WHERE a.published AND NOT EXISTS (SELECT 1 FROM endpoints e WHERE e.api_id=a.id)`],
  ["APIs with no category",
   `SELECT COUNT(*)::text c FROM apis WHERE category_id IS NULL`],
  ["stores with no active key",
   `SELECT COUNT(*)::text c FROM stores s WHERE NOT EXISTS (SELECT 1 FROM api_keys k WHERE k.store_id=s.id AND k.revoked_at IS NULL)`],
  ["usage events pointing at a revoked key",
   `SELECT COUNT(*)::text c FROM usage_events e JOIN api_keys k ON k.id=e.api_key_id WHERE k.revoked_at IS NOT NULL`],
  ["payments stuck pending over a day",
   `SELECT COUNT(*)::text c FROM payments WHERE status='pending' AND created_at < now() - interval '1 day'`],
];
for (const [label, q] of checks) {
  const [r] = await sql.unsafe(q);
  if (Number(r.c) > 0) note(`${label}: ${r.c}`);
}

await sql`DELETE FROM users WHERE email = ${custEmail}`;
console.log(`\n${issues.length} issue${issues.length === 1 ? "" : "s"} found`);
await sql.end();
