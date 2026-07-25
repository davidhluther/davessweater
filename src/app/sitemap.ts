import type { MetadataRoute } from "next";
import { getBlogPosts, postSlug, postCategoryOf } from "@/lib/data";
import { listPublicTowns } from "@/lib/towns";
import { CATEGORIES } from "@/content/resources";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://davessweater.com";
  const [posts, publicTowns] = await Promise.all([getBlogPosts(), listPublicTowns()]);
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
  // The /weather hub plus a forecast page and a scoreboard for each town past
  // the gate (Boone's live at / and /right-wrong-ray, already covered above).
  // Ungated towns emit no URL — the same MIN_SCORED_DAYS gate that hides their
  // pages keeps them out of the sitemap until the day they cross it.
  const townRoutes = [
    { url: `${base}/weather`, changeFrequency: "daily" as const, priority: 0.7 },
    ...publicTowns
      .filter((t) => t.slug !== "boone")
      .flatMap((t) => [
        { url: `${base}/weather/${t.slug}`, changeFrequency: "daily" as const, priority: 0.7 },
        { url: `${base}/right-wrong-ray/${t.slug}`, changeFrequency: "daily" as const, priority: 0.6 },
      ]),
  ];
  return [...routes, apiRoute, ...resourceRoutes, ...staticPages, ...townRoutes, ...postRoutes];
}
