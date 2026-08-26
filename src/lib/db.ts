import "server-only";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and point it at your Postgres " +
      "database (Neon, Vercel Postgres, or a local instance), then run `npm run db:migrate`."
  );
}

declare global {
  // eslint-disable-next-line no-var
  var __zephielSql: ReturnType<typeof postgres> | undefined;
}

/**
 * One pooled client per process. Serverless functions are short-lived and can
 * run many concurrently, so the pool stays small; the global cache keeps HMR in
 * development from opening a new pool on every reload.
 */
export const sql =
  global.__zephielSql ??
  postgres(connectionString, {
    max: process.env.NODE_ENV === "production" ? 1 : 5,
    idle_timeout: 20,
    connect_timeout: 15,
    // Neon and most hosted providers require TLS; local Postgres usually doesn't.
    ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1")
      ? false
      : "require",
  });

if (process.env.NODE_ENV !== "production") global.__zephielSql = sql;
