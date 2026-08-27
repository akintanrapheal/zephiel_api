/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the workspace root so an unrelated lockfile in a parent directory
  // can't be inferred as the project root.
  turbopack: { root: import.meta.dirname },

  // db/schema.sql is read at runtime by the admin "run migrations" action, so
  // it must be traced into the serverless bundle — it is data, not code, and
  // would otherwise be left behind.
  outputFileTracingIncludes: {
    "/admin/settings": ["./db/schema.sql"],
    "/api/admin/migrate": ["./db/schema.sql"],
  },
};

export default nextConfig;
