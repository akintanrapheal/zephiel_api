import type { MetadataRoute } from "next";
import { apis } from "@/data/apis";
import { categories } from "@/data/categories";

const BASE = "https://zephiel-api.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
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
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.7,
  }));

  const apiRoutes = apis.map((a) => ({
    url: `${BASE}/marketplace/${a.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const categoryRoutes = categories.map((c) => ({
    url: `${BASE}/categories/${c.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [...staticRoutes, ...apiRoutes, ...categoryRoutes];
}
