import type { MetadataRoute } from "next";
import { getApis, getCategories } from "@/server/catalog";
import { getPosts } from "@/server/posts";
import { appUrl } from "@/lib/app-url";

// Regenerated hourly so newly published APIs appear without a redeploy.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const BASE = appUrl();
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
    "/legal/gdpr",
  ].map((path) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.7,
  }));

  // This route is prerendered at build time, which may run before the database
  // exists. A sitemap missing its dynamic entries is far better than a failed
  // build; the next revalidation picks them up.
  try {
    const [apis, categories, posts] = await Promise.all([getApis(), getCategories(), getPosts()]);

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
      // Archive posts carry their own publication date rather than `now`, so a
      // crawler sees a decade of stable content instead of 34 pages that all
      // claim to have changed this hour.
      ...posts.map((p) => ({
        url: `${BASE}/blog/${p.slug}`,
        lastModified: new Date(p.publishedAt),
        changeFrequency: "yearly" as const,
        priority: 0.5,
      })),
    ];
  } catch (err) {
    console.warn("sitemap: catalog unavailable, emitting static routes only.", err);
    return staticRoutes;
  }
}
