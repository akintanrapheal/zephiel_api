/* Drops every application table. Destructive — development convenience only. */
import postgres from "postgres";
import { loadEnv } from "./env.mts";

loadEnv();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

if (process.env.NODE_ENV === "production" && !process.env.ALLOW_DB_RESET) {
  console.error("Refusing to reset a production database. Set ALLOW_DB_RESET=1 to override.");
  process.exit(1);
}

const sql = postgres(url, {
  max: 1,
  ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : "require",
});

const tables = [
  "usage_events",
  "payments",
  "subscriptions",
  "api_keys",
  "sessions",
  "users",
  "endpoints",
  "plans",
  "apis",
  "categories",
];

try {
  for (const t of tables) await sql.unsafe(`DROP TABLE IF EXISTS ${t} CASCADE`);
  console.log(`Dropped ${tables.length} tables.`);
} catch (err) {
  console.error("Reset failed:", err instanceof Error ? err.message : err);
  process.exit(1);
} finally {
  await sql.end();
}
