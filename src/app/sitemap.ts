import type { MetadataRoute } from "next";
import { getBlogPosts, getReportCards, postSlug, postCategoryOf } from "@/lib/data";
import { allTowns, latestComparisonDate } from "@/lib/towns";
import { getRoadsForecast } from "@/lib/roads";
import { CATEGORIES } from "@/content/resources";

/**
 * A `lastModified` only when we have a real date for it. Google ignores
 * `changefreq` and `priority`; `lastmod` is the one field it actually reads, so
 * it has to mean something.
 */
function stamp(value?: string | null): { lastModified?: Date } {
  if (!value) return {};
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? {} : { lastModified: d };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://davessweater.com";
  const posts = await getBlogPosts();
  const reportCards = await getReportCards();
  // No blanket lastModified: stamping every URL with the BUILD date (daily,
  // since data commits rebuild the site) teaches Google to distrust it. Build
  // dates are noise. But a data-driven page does have an honest per-URL
  // modification date sitting in the repo — the newest file in its own data
  // directory, which is literally when that page's content last changed. Data
  // dates are honest, so those URLs carry one (added 2026-07-28, after GSC
  // showed the town/roads expansion undiscovered against a sitemap whose bytes
  // never moved):
  //   posts / report cards  → their own published date
  //   town weather + boards → that town's latest scored comparison
  //   / and /right-wrong-ray → Boone's latest comparison (they are Boone's pages)
  //   /weather hub          → the newest comparison across the towns it lists
  //   /roads                → the roads artifact's own generated_at
  // Everything genuinely undated — /about, /methodology, /shop, /api,
  // /resources* — still omits the field, which is the honest answer for a page
  // whose content did not change just because the site rebuilt.
  const towns = await allTowns();
  const townSlugs = towns.filter((t) => t.slug !== "boone").map((t) => t.slug);
  const comparisonDates = new Map<string, string | null>();
  for (const t of towns) comparisonDates.set(t.slug, await latestComparisonDate(t.slug));
  const booneDate = comparisonDates.get("boone") ?? null;
  const roadsDate = (await getRoadsForecast())?.generated_at ?? null;
  const routes = [
    { url: base, ...stamp(booneDate), changeFrequency: "daily" as const, priority: 1 },
    { url: `${base}/right-wrong-ray`, ...stamp(booneDate), changeFrequency: "daily" as const, priority: 0.7 },
    { url: `${base}/roads`, ...stamp(roadsDate), changeFrequency: "daily" as const, priority: 0.7 },
    { url: `${base}/shop`, changeFrequency: "daily" as const, priority: 0.7 },
  ];
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
  //
  // The hub lists every town (Boone included), so its own modification date is
  // the newest of theirs — the day any card on it last changed.
  const hubDate = [...comparisonDates.values()].filter(Boolean).sort().pop() ?? null;
  const weatherHub = { url: `${base}/weather`, ...stamp(hubDate), changeFrequency: "daily" as const, priority: 0.7 };
  const townRoutes = townSlugs.flatMap((slug) => {
    const at = stamp(comparisonDates.get(slug));
    return [
      { url: `${base}/weather/${slug}`, ...at, changeFrequency: "daily" as const, priority: 0.7 },
      { url: `${base}/right-wrong-ray/${slug}`, ...at, changeFrequency: "daily" as const, priority: 0.7 },
    ];
  });
  // The report-card franchise hub + one URL per graded month. Cards are their
  // own home now (excluded from posts above), so they appear here once, never
  // also under /resources/articles.
  const reportCardRoutes = [
    { url: `${base}/report-card`, changeFrequency: "monthly" as const, priority: 0.7 },
    ...reportCards.map((c) => ({
      url: `${base}/report-card/${c.reportMonth}`,
      ...(c.date ? { lastModified: new Date(c.date) } : {}),
      changeFrequency: "monthly" as const, priority: 0.7,
    })),
  ];
  return [...routes, weatherHub, apiRoute, ...resourceRoutes, ...staticPages, ...townRoutes, ...postRoutes, ...reportCardRoutes];
}
