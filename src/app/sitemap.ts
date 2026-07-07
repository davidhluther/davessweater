import type { MetadataRoute } from "next";
import { getBlogPosts, postSlug, postCategoryOf } from "@/lib/data";
import { CATEGORIES } from "@/content/resources";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://davessweater.com";
  const posts = await getBlogPosts();
  const routes = ["", "/right-wrong-ray", "/shop"].map((r) => ({
    url: `${base}${r}`, lastModified: new Date(), changeFrequency: "daily" as const, priority: r === "" ? 1 : 0.7,
  }));
  // The resources hub and its category pages (old /blog and /videos 301 here).
  const resourceRoutes = ["/resources", ...CATEGORIES.map((c) => c.href)].map((r) => ({
    url: `${base}${r}`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 0.6,
  }));
  // Reference/evergreen pages — high priority, low churn.
  const staticPages = [
    { url: `${base}/methodology`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.7 },
    { url: `${base}/reports/fireworks-fourth-july-2026`, lastModified: new Date(), changeFrequency: "daily" as const, priority: 0.8 },
    { url: `${base}/reports/grandfather-mountain-highland-games-planner-2026`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 0.8 },
  ];
  const postRoutes = posts.map((p) => {
    const slug = postSlug(p);
    return {
      url: `${base}/resources/${postCategoryOf(p)}/${slug}`, lastModified: new Date(),
      changeFrequency: "monthly" as const, priority: 0.6,
    };
  });
  return [...routes, ...resourceRoutes, ...staticPages, ...postRoutes];
}
