import "server-only";
import postgres from "postgres";

type Client = ReturnType<typeof postgres>;

declare global {
  // eslint-disable-next-line no-var
  var __zephielSql: Client | undefined;
}

const MISSING_URL =
  "DATABASE_URL is not set. On Vercel, add a Postgres database under Storage (Neon sets this " +
  "for you). Locally, copy .env.example to .env.local and point DATABASE_URL at your database, " +
  "then run `npm run db:migrate`.";

function connect(): Client {
  if (global.__zephielSql) return global.__zephielSql;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error(MISSING_URL);

  const client = postgres(connectionString, {
    max: process.env.NODE_ENV === "production" ? 1 : 5,
    idle_timeout: 20,
    connect_timeout: 15,
    // Hosted providers require TLS; a local instance usually doesn't.
    ssl:
      connectionString.includes("localhost") || connectionString.includes("127.0.0.1")
        ? false
        : "require",
  });

  // Cached in every environment: serverless functions reuse a warm module
  // between invocations, and in development it stops HMR opening a new pool
  // on each reload.
  global.__zephielSql = client;
  return client;
}

/**
 * The connection is opened on first use rather than at module load.
 *
 * `next build` evaluates every module while collecting page data, so
 * connecting eagerly would make a missing DATABASE_URL fail the build itself —
 * even though no page queries anything at build time. Deferring it means a
 * misconfigured environment surfaces as a clear runtime error on the request
 * that actually needs the database.
 */
export const sql = new Proxy((() => {}) as unknown as Client, {
  apply(_target, _thisArg, args: Parameters<Client>) {
    return Reflect.apply(connect() as (...a: unknown[]) => unknown, undefined, args);
  },
  get(_target, prop: string | symbol) {
    const client = connect() as unknown as Record<string | symbol, unknown>;
    const value = client[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
}) as Client;
