// The resources hub: category definitions, post categorization, and the
// curated reports list. Feed posts (data/substack_feed.json) carry no category
// of their own, so they default to "news"; list a slug in ARTICLE_SLUGS to
// shelve it under Articles instead. A pre-split slug moved to Articles also
// needs its own redirect entry in next.config.ts (the blanket /blog/:slug
// redirect assumes news).

export type PostCategory = "articles" | "news";

export const ARTICLE_SLUGS = new Set<string>([]);

export function postCategory(slug: string): PostCategory {
  return ARTICLE_SLUGS.has(slug) ? "articles" : "news";
}

// Reports are curated by hand — one entry per published report. The fireworks
// report joins this list when it ships (href of its live route, e.g. "/fireworks").
export interface ReportEntry {
  title: string;
  href: string;
  date?: string; // ISO, rendered "Month D, YYYY"
  summary?: string;
}

export const REPORTS: ReportEntry[] = [];

export const CATEGORIES = [
  { key: "articles", label: "Articles", href: "/resources/articles", blurb: "Longer reads on mountain weather and how we track it." },
  { key: "news", label: "News & Updates", href: "/resources/news", blurb: "What's new on Dave's Sweater — features, fixes, and announcements." },
  { key: "videos", label: "Videos", href: "/resources/videos", blurb: "The forecast, but with moving pictures." },
  { key: "reports", label: "Reports", href: "/resources/reports", blurb: "Data deep-dives with charts and receipts." },
] as const;

export type CategoryDef = (typeof CATEGORIES)[number];
