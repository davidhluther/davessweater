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
// report joins this list when it ships (href of its live route, e.g. "/reports/fireworks-fourth-july-2026").
export interface ReportEntry {
  title: string;
  href: string;
  date?: string; // ISO, rendered "Month D, YYYY"
  summary?: string;
  image?: string; // public/ path; keep alt honest — no local-show claims on stock art
  imageAlt?: string;
}

export const REPORTS: ReportEntry[] = [
  {
    title: "Grandfather Mountain Highland Games 2026: Schedule, Parking & Day Planner",
    href: "/reports/grandfather-mountain-highland-games-planner-2026",
    date: "2026-07-06",
    summary:
      "A free, genuinely useful planner for the 70th Games (July 9–12): Filter the schedule, then get it back the way you need it — a downloadable, printable per-day itinerary, a field map with your stops pinned, arrive-by and between-event walk times, the right lot and shuttle fare, a live mountain forecast with packing list, and a calendar export. Everything the official schedule leaves you to figure out.",
    image: "/assets/gmhg-torch-lighting-photo-by-skip-sickler-courtesy-grandfather-mountain-stewardship-foundation-sm.webp",
    imageAlt: "Clan members holding lit torches at dusk during the Grandfather Mountain Highland Games torch-lighting ceremony. Photo by Skip Sickler, courtesy of the Grandfather Mountain Stewardship Foundation.",
  },
  {
    title: "2026 Fourth of July fireworks in Boone and the High Country: Exact times, computed",
    href: "/reports/fireworks-fourth-july-2026",
    date: "2026-07-02",
    summary:
      "What you get: Fireworks-specific weather for each show (clouds, wind, fog), start times projected from dusk math and mountain terrain, verified event details, and a sightline check from any address.",
    // CC0 1.0, owner-supplied ("Feuerwerk_1"); generic fireworks, not a local shot.
    image: "/assets/fireworks-photo.webp",
    imageAlt: "Fireworks bursting against a night sky",
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
    description: "News and updates from Dave's Sweater: New features, scoring changes, and announcements.",
  },
  {
    key: "videos", label: "Videos", schemaName: "Videos", href: "/resources/videos",
    blurb: "The forecast, but with moving pictures.",
    description: "Weather videos from Dave's Sweater, Boone's most mostly reliable weather tracker.",
  },
  {
    key: "reports", label: "Reports", schemaName: "Reports", href: "/resources/reports",
    blurb: "Data deep-dives with charts and receipts.",
    description: "Data reports from Dave's Sweater: Deep dives into Boone, NC forecast accuracy, with charts and receipts.",
  },
] as const;

export type CategoryDef = (typeof CATEGORIES)[number];
