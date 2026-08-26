import type { MetadataRoute } from "next";
import { getApis, getCategories } from "@/server/catalog";

const BASE = (process.env.NEXT_PUBLIC_APP_URL ?? "https://zephiel-api.vercel.app").replace(/\/$/, "");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [apis, categories] = await Promise.all([getApis(), getCategories()]);
  const now = new Date();

  const staticRoutes = [
    "",
    "/marketplace",
    "/categories",
    "/pricing",
    "/docs",
    "/status",
    "/about",
    "/providers",
    "/blog",
    "/contact",
    "/legal/terms",
  ].map((path) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.7,
  }));

  return [
    ...staticRoutes,
    ...apis.map((a) => ({
      url: `${BASE}/marketplace/${a.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...categories.map((c) => ({
      url: `${BASE}/categories/${c.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
