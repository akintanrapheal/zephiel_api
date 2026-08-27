# Zephiel API

An API marketplace with a working backend: a Postgres-backed catalog, real accounts and sessions,
issued API keys, a metered gateway those keys authenticate against, Paystack checkout, and an admin
area to run all of it.

Built with Next.js 16 (App Router), TypeScript, Tailwind CSS, and `postgres`.

---

## Quick start

```bash
npm install
cp .env.example .env.local        # then fill in DATABASE_URL
npm run db:migrate                # create the schema
npm run db:seed                   # load 26 APIs, 9 categories, and an admin user
npm run dev                       # http://localhost:3000
```

The seed creates the first administrator and prints the credentials **once**. If `ADMIN_PASSWORD` is
not set it generates a random one — save it from the output, because it is not shown again. Set
`ADMIN_EMAIL` / `ADMIN_PASSWORD` before seeding to choose your own.

> **Never deploy with a password that appears in a repository, issue, or chat log.** Change it at
> `/admin/settings`, or run `npm run admin:password`, which prompts without echoing and signs out
> every existing session.

### Getting a database

- **Vercel/Neon (recommended):** in the Vercel dashboard go to *Storage → Create Database → Neon*.
  Vercel injects `DATABASE_URL` automatically. Copy the same pooled URL into `.env.local` for local
  development, or create a Neon branch for it.
- **Docker, offline:**
  ```bash
  docker run -d --name zephiel-pg -e POSTGRES_PASSWORD=zephiel -e POSTGRES_DB=zephiel \
    -p 55432:5432 postgres:16-alpine
  # DATABASE_URL=postgres://postgres:zephiel@localhost:55432/zephiel
  ```

After a deploy that changes `db/schema.sql`, apply it from **Admin → Settings → Database schema**, which
reports what is missing and applies it in one click. `npm run db:migrate` does the same from a terminal.

`db:migrate` is idempotent, and `db:seed` upserts by slug — re-running either is safe and won't
disturb users, subscriptions, or payments. `npm run db:reset` drops every table (development only).

---

## Environment variables

| Variable | Required | What it does |
|---|---|---|
| `DATABASE_URL` | **yes** | Postgres connection string. Use the *pooled* URL on Vercel. |
| `APP_URL` | no on Vercel | Absolute origin, no trailing slash. Falls back to Vercel's own domain, then localhost. Server-only, so it takes no `NEXT_PUBLIC_` prefix. |
| `PAYSTACK_SECRET_KEY` | for paid plans | Optional — the key can instead be set in the admin console at /admin/settings, which takes precedence. Free plans work without either. |
| `PAYSTACK_CURRENCY` | no | `NGN` (default), `GHS`, `ZAR`, `KES`, or `USD` — whatever your Paystack account settles in. |
| `USD_TO_NGN` | no | Catalog prices are stored in USD; this converts them at charge time. Default `1550`. |
| `RESEND_API_KEY` | for reminders | Or set it in the admin console. Without it the sweep runs but sends nothing. |
| `CRON_SECRET` | for reminders | Bearer token Vercel Cron presents; the endpoint refuses to run without it. |
| `SETTINGS_KEY` | recommended | Encrypts secrets stored from the admin console (AES-256-GCM). Falls back to deriving from `DATABASE_URL`, which breaks if the database password is rotated. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | no | Used only by `db:seed` to create the first administrator. |

---

## What works end to end

Verified by `npm run test:e2e` — 98 checks against a running server, driving real HTTP (server
actions are submitted the way a browser without JavaScript would).

**Accounts.** Sign up and sign in with scrypt-hashed passwords and DB-backed session cookies
(httpOnly, SameSite=Lax, 30 days). Signing up issues a working API key immediately. Duplicate emails
are rejected; a failed sign-in reveals nothing about whether the account exists.

**Authorisation.** `/dashboard` requires a session; `/admin` additionally requires `role = 'admin'`.
Anonymous and customer accounts are redirected, not shown a partial page.

**Subscriptions.** Free plans activate immediately. Paid plans create a `pending` subscription plus a
`payments` row, then hand off to Paystack Checkout. Per-unit plans (Multistore's $50/store) ask how
many units and multiply the charge.

**Payments.** Paystack's callback and its `charge.success` webhook both route through one idempotent
activation path, so whichever arrives first activates the subscription and the second is a no-op.
Webhook bodies are verified with HMAC-SHA512 over the raw bytes before being parsed.

**The gateway.** `/api/v1/{slug}/{...path}` authenticates the key, checks for an active subscription,
enforces the quota, increments usage, records a `usage_events` row, and returns rate-limit headers:

```bash
curl -H "X-Zephiel-Key: zk_live_..." http://localhost:3000/api/v1/multistore/stores
```

Returns `401` without a valid key, `403` without a subscription, `429` past quota, `401` for a revoked
key. Those calls are what the dashboard's usage chart and the admin overview are counting.

**Settings.** Paystack credentials are editable at `/admin/settings` — the key is verified against Paystack before it is saved, stored encrypted, never displayed again, and takes precedence over the environment variable. The page also surfaces the webhook URL to copy and a connection test.

**Admin.** Create, edit, publish/unpublish, and delete APIs; manage their plans and endpoints inline;
CRUD categories; promote or demote users (the last remaining admin can't demote themselves); review
subscriptions and payments. Edits appear on the public marketplace immediately via `revalidatePath`.

### What is *not* wired up

- **The 26 seeded APIs are fictional.** There are no upstream providers, so the gateway returns each
  listing's stored sample response. Everything around it — auth, quota, metering, headers — is real.
- **Paid checkout needs your Paystack keys.** Without `PAYSTACK_SECRET_KEY` the subscribe button on a
  paid plan shows an explanatory message and free plans still work. The e2e suite covers signature
  verification but not a real card charge.
- **No password reset or email delivery.**
- Uptime bars on `/status` and the review lists are still illustrative.

---

## Routes

| Route | |
|---|---|
| `/` | Landing page — hero, live code sample, featured and trending APIs, categories |
| `/marketplace`, `/marketplace/[slug]` | Catalog with search/filter/sort; detail page with plans, endpoints, reviews, subscribe |
| `/categories`, `/categories/[slug]` | Category index and category-scoped catalog |
| `/pricing`, `/docs`, `/status` | Platform plans, full API reference, per-API uptime |
| `/legal/terms`, `/legal/gdpr` | Terms, and a GDPR page documenting data categories, retention, subprocessors, and rights |
| `/signup`, `/signin` | Real authentication |
| `/dashboard` | Signed-in area with its own chrome: overview, stores, usage, keys, playground |
| `/dashboard/stores` | Connect storefronts, each with its own key, and a 5-minute per-store call chart |
| `/dashboard/playground` | Fire real gateway requests and inspect the response |
| `/admin/login` | Administrator sign-in, separate from customer auth |
| `/admin`, `/admin/apis`, `/admin/categories`, `/admin/users`, `/admin/subscriptions`, `/admin/payments`, `/admin/settings` | Admin console |
| `/billing/callback` | Paystack return URL |

**JSON endpoints:** `GET /api/apis`, `GET /api/apis/[slug]`, `GET /api/categories`,
`POST /api/paystack/webhook`, and the gateway at `/api/v1/[slug]/[...path]`.

---

## Deploying to Vercel

1. Push to GitHub and import the repo at [vercel.com/new](https://vercel.com/new).
2. Add a Neon database under *Storage* (this sets `DATABASE_URL`).
3. Add `PAYSTACK_SECRET_KEY` and `PAYSTACK_CURRENCY` if you want paid checkout. `APP_URL` is
   optional — Vercel supplies the production domain automatically.
4. Deploy, then run the migration and seed once against the production database:
   ```bash
   DATABASE_URL="<your production url>" npm run db:migrate
   DATABASE_URL="<your production url>" npm run db:seed
   ```
5. In the Paystack dashboard set the webhook URL to `https://<your-domain>/api/paystack/webhook`.

---

## Project layout

```
db/schema.sql              Full DDL — idempotent, the single source of truth
scripts/                   migrate, seed, reset, e2e, and admin/user maintenance
src/lib/
  db.ts                    Pooled postgres client
  auth.ts                  Password hashing, sessions, API key generation
  paystack.ts              Initialize, verify, webhook signature, currency conversion
  types.ts                 Domain types shared by the DB layer and the components
  settings.ts              Encrypted runtime settings (admin-editable)
  icons.ts                 Icon registry for listings
src/server/
  catalog.ts               Public catalog queries (one round trip per page)
  account.ts               Dashboard queries
  admin.ts                 Admin queries
  billing.ts               Idempotent payment activation
  actions/                 Server actions: auth, keys, subscribe, admin
src/data/                  Seed content only — the app reads from Postgres
```

Adding an API through the admin UI is the normal path; `src/data/apis.ts` exists so a fresh database
starts with something in it.

### Security notes

Passwords use scrypt with a per-user salt. API keys are random 160-bit strings stored only as SHA-256
digests — the plaintext is shown once at creation and cannot be recovered. Sessions are opaque random
IDs checked against the database on every request, so revocation is immediate. All SQL goes through
tagged templates, which parameterise every interpolation.
