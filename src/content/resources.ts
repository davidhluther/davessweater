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

export const REPORTS: ReportEntry[] = [
  {
    title: "2026 Fourth of July fireworks in Boone and the High Country: exact times, computed",
    href: "/fireworks",
    date: "2026-07-02",
    summary:
      "Per-venue dusk math, verified show details, terrain sightlines, and a fireworks-specific forecast for every High Country show.",
  },
];

// label = UI text; schemaName = the same name with raw "&" avoided (JSON-LD
// renders through an HTML-escaping component); description = meta description.
export const CATEGORIES = [
  {
    key: "articles", label: "Articles", schemaName: "Articles", href: "/resources/articles",
    blurb: "Longer reads on mountain weather and how we track it.",
    description: "Longer reads on Boone mountain weather and how Dave's Sweater tracks forecast accuracy.",
  },
  {
    key: "news", label: "News & Updates", schemaName: "News and Updates", href: "/resources/news",
    blurb: "What's new on Dave's Sweater — features, fixes, and announcements.",
    description: "News and updates from Dave's Sweater: new features, scoring changes, and announcements.",
  },
  {
    key: "videos", label: "Videos", schemaName: "Videos", href: "/resources/videos",
    blurb: "The forecast, but with moving pictures.",
    description: "Weather videos from Dave's Sweater, Boone's most mostly reliable weather tracker.",
  },
  {
    key: "reports", label: "Reports", schemaName: "Reports", href: "/resources/reports",
    blurb: "Data deep-dives with charts and receipts.",
    description: "Data reports from Dave's Sweater: deep dives into Boone, NC forecast accuracy, with charts and receipts.",
  },
] as const;

export type CategoryDef = (typeof CATEGORIES)[number];
