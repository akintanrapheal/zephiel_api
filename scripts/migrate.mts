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

let skipped = 0;

const sql = postgres(url, {
  max: 1,
  ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : "require",
  // Postgres emits a NOTICE for every "already exists, skipping" — expected
  // for an idempotent schema, and dumping the raw objects made a successful
  // run look like a wall of errors. Summarise instead.
  onnotice: (notice) => {
    if (notice.code === "42P07" || notice.code === "42701" || notice.code === "42710") {
      skipped += 1;
      return;
    }
    console.log(`NOTICE: ${notice.message}`);
  },
});

const schema = readFileSync(resolve(process.cwd(), "db/schema.sql"), "utf8");

try {
  await sql.unsafe(schema);
  console.log(
    skipped > 0
      ? `Schema applied. ${skipped} object${skipped === 1 ? "" : "s"} already existed and were left alone.`
      : "Schema applied."
  );
} catch (err) {
  console.error("Migration failed:", err instanceof Error ? err.message : err);
  process.exit(1);
} finally {
  await sql.end();
}
