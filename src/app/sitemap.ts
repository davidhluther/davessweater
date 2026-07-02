import type { MetadataRoute } from "next";
import { getBlogPosts, slugFromLink } from "@/lib/data";
import { CATEGORIES, postCategory } from "@/content/resources";

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
    { url: `${base}/fireworks`, lastModified: new Date(), changeFrequency: "daily" as const, priority: 0.8 },
  ];
  const postRoutes = posts.map((p) => {
    const slug = slugFromLink(p.link, p.title);
    return {
      url: `${base}/resources/${postCategory(slug)}/${slug}`, lastModified: new Date(),
      changeFrequency: "monthly" as const, priority: 0.6,
    };
  });
  return [...routes, ...resourceRoutes, ...staticPages, ...postRoutes];
}
