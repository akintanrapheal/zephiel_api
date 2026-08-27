-- Zephiel API — schema
-- Idempotent: safe to run repeatedly (npm run db:migrate).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------- catalog --

CREATE TABLE IF NOT EXISTS categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text UNIQUE NOT NULL,
  name        text NOT NULL,
  blurb       text NOT NULL DEFAULT '',
  icon        text NOT NULL DEFAULT '',
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS apis (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text UNIQUE NOT NULL,
  name            text NOT NULL,
  tagline         text NOT NULL DEFAULT '',
  description     text NOT NULL DEFAULT '',
  category_id     uuid REFERENCES categories(id) ON DELETE SET NULL,
  provider        text NOT NULL DEFAULT '',
  logo            text NOT NULL DEFAULT '',
  color           text NOT NULL DEFAULT '#2445d6',
  rating          numeric(2,1) NOT NULL DEFAULT 5.0,
  reviews         integer NOT NULL DEFAULT 0,
  subscribers     integer NOT NULL DEFAULT 0,
  latency         integer NOT NULL DEFAULT 100,
  uptime          numeric(5,2) NOT NULL DEFAULT 99.9,
  featured        boolean NOT NULL DEFAULT false,
  free_tier       boolean NOT NULL DEFAULT true,
  published       boolean NOT NULL DEFAULT true,
  tags            text[] NOT NULL DEFAULT '{}',
  use_cases       text[] NOT NULL DEFAULT '{}',
  sample_response text NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS apis_category_idx  ON apis(category_id);
CREATE INDEX IF NOT EXISTS apis_published_idx ON apis(published);

CREATE TABLE IF NOT EXISTS plans (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id      uuid NOT NULL REFERENCES apis(id) ON DELETE CASCADE,
  name        text NOT NULL,
  price       numeric(10,2) NOT NULL DEFAULT 0,
  unit        text,
  requests    text NOT NULL DEFAULT '',
  rate_limit  text NOT NULL DEFAULT '',
  features    text[] NOT NULL DEFAULT '{}',
  popular     boolean NOT NULL DEFAULT false,
  quota       integer NOT NULL DEFAULT 100,
  sort_order  integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS plans_api_idx ON plans(api_id);

CREATE TABLE IF NOT EXISTS endpoints (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id      uuid NOT NULL REFERENCES apis(id) ON DELETE CASCADE,
  method      text NOT NULL DEFAULT 'GET',
  path        text NOT NULL,
  summary     text NOT NULL DEFAULT '',
  sort_order  integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS endpoints_api_idx ON endpoints(api_id);

-- ------------------------------------------------------ accounts & access --

CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  name          text NOT NULL DEFAULT '',
  password_hash text NOT NULL,
  role          text NOT NULL DEFAULT 'customer' CHECK (role IN ('admin','customer')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id         text PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

CREATE TABLE IF NOT EXISTS api_keys (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label        text NOT NULL DEFAULT 'Default',
  scope        text NOT NULL DEFAULT 'All APIs',
  key_prefix   text NOT NULL,
  key_hash     text UNIQUE NOT NULL,
  last_used_at timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_keys_user_idx ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS api_keys_hash_idx ON api_keys(key_hash);

-- ------------------------------------------------ subscriptions & billing --

CREATE TABLE IF NOT EXISTS subscriptions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  api_id             uuid NOT NULL REFERENCES apis(id) ON DELETE CASCADE,
  plan_id            uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  status             text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('active','pending','cancelled','expired')),
  quota              integer NOT NULL DEFAULT 100,
  used               integer NOT NULL DEFAULT 0,
  -- Billable units for per-unit plans (e.g. number of connected stores).
  units              integer NOT NULL DEFAULT 1,
  current_period_end timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, api_id)
);

CREATE INDEX IF NOT EXISTS subscriptions_user_idx ON subscriptions(user_id);

CREATE TABLE IF NOT EXISTS payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES users(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  reference       text UNIQUE NOT NULL,
  amount          numeric(12,2) NOT NULL DEFAULT 0,
  currency        text NOT NULL DEFAULT 'NGN',
  status          text NOT NULL DEFAULT 'pending',
  channel         text,
  raw             jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  paid_at         timestamptz
);

CREATE INDEX IF NOT EXISTS payments_user_idx ON payments(user_id);

-- ------------------------------------------------------------- metering --

CREATE TABLE IF NOT EXISTS usage_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  api_id     uuid NOT NULL REFERENCES apis(id) ON DELETE CASCADE,
  api_key_id uuid REFERENCES api_keys(id) ON DELETE SET NULL,
  endpoint   text NOT NULL DEFAULT '/',
  method     text NOT NULL DEFAULT 'GET',
  status     integer NOT NULL DEFAULT 200,
  latency_ms integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS usage_user_created_idx ON usage_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS usage_api_idx          ON usage_events(api_id);

-- ------------------------------------------------------------- settings --

-- Runtime configuration editable from the admin console. Secret values are
-- stored encrypted (see src/lib/settings.ts); non-secrets are plaintext.
CREATE TABLE IF NOT EXISTS settings (
  key        text PRIMARY KEY,
  value      text NOT NULL DEFAULT '',
  is_secret  boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);

-- Per-listing icon, stored as a key into the registry in src/lib/icons.ts.
-- Falls back to the two-letter monogram when empty.
ALTER TABLE apis ADD COLUMN IF NOT EXISTS icon text NOT NULL DEFAULT '';

-- --------------------------------------------------------------- stores --

-- Connected storefronts under a per-unit subscription (the Multistore API).
-- Each store carries its own API key so traffic can be attributed and a single
-- store revoked without disturbing the others.
CREATE TABLE IF NOT EXISTS stores (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  name            text NOT NULL,
  platform        text NOT NULL DEFAULT 'shopify',
  status          text NOT NULL DEFAULT 'synced'
                  CHECK (status IN ('synced','syncing','sandbox','error')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stores_user_idx ON stores(user_id);
CREATE INDEX IF NOT EXISTS stores_sub_idx  ON stores(subscription_id);

-- A key may be scoped to one store; NULL means an account-wide key.
ALTER TABLE api_keys     ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES stores(id) ON DELETE CASCADE;
ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES stores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS usage_store_created_idx ON usage_events(store_id, created_at DESC);

-- Optional storefront URL — the only identifier a custom/headless store has.
ALTER TABLE stores ADD COLUMN IF NOT EXISTS domain text NOT NULL DEFAULT '';

-- --------------------------------------------------------- notifications --

-- Outbound emails we have sent about a subscription. The unique constraint is
-- the deduplication: one reminder of each kind per billing period, however
-- many times the sweep runs.
CREATE TABLE IF NOT EXISTS notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE CASCADE,
  kind            text NOT NULL,
  period_end      timestamptz,
  status          text NOT NULL DEFAULT 'sent',
  detail          text NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS notifications_once_idx
  ON notifications(subscription_id, kind, period_end);

CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id, created_at DESC);

-- --------------------------------------------------------- usage rollups --

-- Historical call volume, one row per user/api/store/day.
--
-- usage_events is the hot table — every individual call, kept for the recent
-- window that intraday charts need. Anything older is summarised here, because
-- storing millions of rows to draw a daily line is wasteful and slow.
CREATE TABLE IF NOT EXISTS usage_daily (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  api_id     uuid NOT NULL REFERENCES apis(id) ON DELETE CASCADE,
  store_id   uuid REFERENCES stores(id) ON DELETE CASCADE,
  day        date NOT NULL,
  calls      bigint NOT NULL DEFAULT 0,
  errors     bigint NOT NULL DEFAULT 0,
  avg_latency integer NOT NULL DEFAULT 0
);

-- store_id is nullable, so a composite primary key will not do: NULLs would
-- never conflict. COALESCE to a sentinel gives one row per store-or-none.
CREATE UNIQUE INDEX IF NOT EXISTS usage_daily_key_idx
  ON usage_daily(user_id, api_id, day, COALESCE(store_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE INDEX IF NOT EXISTS usage_daily_user_day_idx ON usage_daily(user_id, day);

-- Keep a demonstration account's charts alive: when set, the intraday window
-- is topped up on read and the daily curve is extended by the rollup job.
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS demo_traffic boolean NOT NULL DEFAULT false;

-- --------------------------------------------------------------- reviews --

-- One review per customer per API. Ratings shown on a listing are computed
-- from these rows, so the distribution can never contradict the average.
CREATE TABLE IF NOT EXISTS reviews (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id     uuid NOT NULL REFERENCES apis(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating     integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title      text NOT NULL DEFAULT '',
  body       text NOT NULL DEFAULT '',
  role       text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (api_id, user_id)
);

CREATE INDEX IF NOT EXISTS reviews_api_idx ON reviews(api_id, created_at DESC);

-- -------------------------------------------------------- password resets --

-- Only the digest is stored, so a leaked table cannot be used to reset anyone.
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash text PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS password_resets_user_idx ON password_resets(user_id);

-- ----------------------------------------------------------------- posts --

CREATE TABLE IF NOT EXISTS posts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text UNIQUE NOT NULL,
  title        text NOT NULL,
  excerpt      text NOT NULL DEFAULT '',
  body         text NOT NULL DEFAULT '',
  tag          text NOT NULL DEFAULT 'Engineering',
  read_minutes integer NOT NULL DEFAULT 5,
  published    boolean NOT NULL DEFAULT true,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS posts_published_idx ON posts(published, published_at DESC);

-- ----------------------------------------------------------- subscribers --

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text UNIQUE NOT NULL,
  source         text NOT NULL DEFAULT 'footer',
  confirmed      boolean NOT NULL DEFAULT true,
  unsubscribed_at timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);
