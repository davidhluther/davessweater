import type { MetadataRoute } from "next";
import { getBlogPosts, slugFromLink } from "@/lib/data";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://davessweater.com";
  const posts = await getBlogPosts();
  const routes = ["", "/right-wrong-ray", "/videos", "/blog", "/shop"].map((r) => ({
    url: `${base}${r}`, lastModified: new Date(), changeFrequency: "daily" as const, priority: r === "" ? 1 : 0.7,
  }));
  // Reference/evergreen pages — high priority, low churn.
  const staticPages = [
    { url: `${base}/methodology`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.7 },
    { url: `${base}/fireworks`, lastModified: new Date(), changeFrequency: "daily" as const, priority: 0.8 },
  ];
  const postRoutes = posts.map((p) => ({
    url: `${base}/blog/${slugFromLink(p.link, p.title)}`, lastModified: new Date(),
    changeFrequency: "monthly" as const, priority: 0.6,
  }));
  return [...routes, ...staticPages, ...postRoutes];
}
