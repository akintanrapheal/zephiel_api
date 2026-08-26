/* Applies db/schema.sql. Idempotent — safe to run repeatedly. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";
import { loadEnv } from "./env.mts";

loadEnv();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Add it to .env.local (see .env.example).");
  process.exit(1);
}

const sql = postgres(url, {
  max: 1,
  ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : "require",
});

const schema = readFileSync(resolve(process.cwd(), "db/schema.sql"), "utf8");

try {
  await sql.unsafe(schema);
  console.log("Schema applied.");
} catch (err) {
  console.error("Migration failed:", err instanceof Error ? err.message : err);
  process.exit(1);
} finally {
  await sql.end();
}
