import type { MetadataRoute } from "next";
import { getBlogPosts, postSlug, postCategoryOf } from "@/lib/data";
import { allTowns } from "@/lib/towns";
import { CATEGORIES } from "@/content/resources";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://davessweater.com";
  const posts = await getBlogPosts();
  // No blanket lastModified: stamping every URL with the build date (daily,
  // since data commits rebuild the site) teaches Google to distrust it. Posts
  // carry their real dates; everything else omits the field honestly.
  const routes = ["", "/right-wrong-ray", "/roads", "/shop"].map((r) => ({
    url: `${base}${r}`, changeFrequency: "daily" as const, priority: r === "" ? 1 : 0.7,
  }));
  // The free-data hub (JSON API, RSS feeds, widget docs).
  const apiRoute = { url: `${base}/api`, changeFrequency: "monthly" as const, priority: 0.6 };
  // The resources hub and its category pages (old /blog and /videos 301 here).
  const resourceRoutes = ["/resources", ...CATEGORIES.map((c) => c.href)].map((r) => ({
    url: `${base}${r}`, changeFrequency: "weekly" as const, priority: 0.6,
  }));
  // Reference/evergreen pages — high priority, low churn.
  const staticPages = [
    { url: `${base}/methodology`, changeFrequency: "monthly" as const, priority: 0.7 },
    { url: `${base}/about`, changeFrequency: "monthly" as const, priority: 0.6 },
    { url: `${base}/reports/fireworks-fourth-july-2026`, changeFrequency: "daily" as const, priority: 0.8 },
    { url: `${base}/reports/grandfather-mountain-highland-games-planner-2026`, changeFrequency: "weekly" as const, priority: 0.8 },
  ];
  const postRoutes = posts.map((p) => {
    const slug = postSlug(p);
    return {
      url: `${base}/resources/${postCategoryOf(p)}/${slug}`,
      ...(p.date ? { lastModified: new Date(p.date) } : {}),
      changeFrequency: "monthly" as const, priority: 0.6,
    };
  });
  // Multi-location: the /weather hub plus a forecast + accuracy-board URL for
  // every registered town. Ships from day one with self-canonical entries (the
  // two http-era GSC lessons); Boone is deliberately excluded — it keeps `/` and
  // the root /right-wrong-ray, with no /weather/boone twin. New towns appear here
  // automatically as the registry grows.
  const towns = await allTowns();
  const townSlugs = towns.filter((t) => t.slug !== "boone").map((t) => t.slug);
  const weatherHub = { url: `${base}/weather`, changeFrequency: "daily" as const, priority: 0.7 };
  const townRoutes = townSlugs.flatMap((slug) => [
    { url: `${base}/weather/${slug}`, changeFrequency: "daily" as const, priority: 0.7 },
    { url: `${base}/right-wrong-ray/${slug}`, changeFrequency: "daily" as const, priority: 0.7 },
  ]);
  return [...routes, weatherHub, apiRoute, ...resourceRoutes, ...staticPages, ...townRoutes, ...postRoutes];
}
