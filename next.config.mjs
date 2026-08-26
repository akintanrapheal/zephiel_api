/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the workspace root so an unrelated lockfile in a parent directory
  // can't be inferred as the project root.
  turbopack: { root: import.meta.dirname },
};

export default nextConfig;
