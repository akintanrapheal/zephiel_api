# Zephiel API

An API marketplace — browse, compare, and subscribe to production-grade REST APIs behind a single key.
Built with Next.js 15 (App Router), TypeScript, and Tailwind CSS. Zero external services required to run.

## Running locally

```bash
npm install
npm run dev        # http://localhost:3000
```

```bash
npm run build      # production build
npm start          # serve the production build
```

## Deploying to Vercel

The project needs no environment variables and no build configuration — Vercel detects Next.js
automatically.

**Option A — dashboard (easiest)**

1. Push this folder to a GitHub/GitLab/Bitbucket repo.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repo.
3. Leave every setting at its default and click **Deploy**.

**Option B — CLI**

```bash
npm i -g vercel
vercel          # preview deployment
vercel --prod   # production deployment
```

After the first deploy, update the hardcoded production URL in three places so canonical URLs,
sitemap, and robots point at your real domain:

- `src/app/layout.tsx` → `metadataBase`
- `src/app/sitemap.ts` → `BASE`
- `src/app/robots.ts` → `sitemap`

## What's in the box

| Route | What it does |
|---|---|
| `/` | Landing page — hero, live code sample, stats, featured + trending APIs, categories, CTA |
| `/marketplace` | Full catalog with live search, category pills, free-tier filter, and sorting |
| `/marketplace/[slug]` | API detail — overview, endpoint reference, pricing tiers, reviews, related APIs |
| `/categories` | All eight categories with counts |
| `/categories/[slug]` | Category-scoped catalog |
| `/pricing` | Platform plans, feature comparison table, FAQ |
| `/docs` | Auth, quickstart, request/response shape, error table, rate limits, webhooks, SDKs |
| `/dashboard` | Usage chart, subscriptions with quota bars, recent requests, API key management |
| `/status` | 90-day uptime history per API |
| `/signin`, `/signup` | Auth forms (UI only) |
| `/about`, `/providers`, `/blog`, `/contact`, `/legal/terms` | Supporting marketing pages |

### JSON endpoints

The catalog is also exposed as JSON, so a client app could consume it directly:

```
GET /api/apis?category=finance&q=currency&free=true&limit=10
GET /api/apis/[slug]
GET /api/categories
```

### Also included

- Dark mode with no flash on load (inline pre-hydration script + `localStorage` persistence)
- Per-page SEO metadata, Open Graph tags, generated `sitemap.xml` and `robots.txt`
- Static generation for all 24 API pages and 8 category pages
- Fully responsive, keyboard-accessible, mobile nav

## Customising

Everything the marketplace displays lives in two files:

- **`src/data/apis.ts`** — the 24 listings. Each entry carries its tagline, description, provider,
  category, rating, latency, tags, use cases, endpoint list, a sample JSON response, and four pricing
  tiers. Add an object here and it appears everywhere: catalog, search, category page, sitemap, and JSON
  API, with its own statically generated detail page.
- **`src/data/categories.ts`** — the eight categories and their icons.

Brand colors and design tokens are in `tailwind.config.ts` (`brand`, `accent`) and
`src/app/globals.css` (light/dark surface tokens).

## Making it a real product

The UI is complete; these are the pieces that would need a backend:

1. **Auth** — swap `src/components/AuthForm.tsx` for NextAuth, Clerk, or Supabase Auth.
2. **Billing** — wire the Subscribe buttons to Stripe Checkout; store subscriptions per user.
3. **Metering + gateway** — a route handler that validates keys, checks quota, proxies to the upstream
   provider, and records the call.
4. **Real dashboard data** — replace the sample series in `src/app/dashboard/page.tsx` with queries
   against your metering store.
5. **Contact form** — point `ContactForm` at a route handler or a form service.

Sample data in the dashboard and status pages is generated deterministically so server and client
markup always match — keep that property if you replace it with anything time-based.
