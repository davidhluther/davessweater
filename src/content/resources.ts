// The resources hub: category definitions, post categorization, and the
// curated reports list. Feed posts (data/substack_feed.json) carry no category
// of their own, so they default to "news"; list a slug in ARTICLE_SLUGS to
// shelve it under Articles instead. A pre-split slug moved to Articles also
// needs its own redirect entry in next.config.ts (the blanket /blog/:slug
// redirect assumes news).

export type PostCategory = "articles" | "news";

export const ARTICLE_SLUGS = new Set<string>([]);

// The categories that are backed by posts and so get a /resources/[category]
// route. Videos and reports have their own static routes. Shared so the route's
// page and its OG/Twitter image routes emit the same static params — they must
// agree or the image route silently stays a serverless function (see the Vercel
// Hobby 12-function ceiling note in CHECKLIST.md).
export const POST_CATEGORIES: PostCategory[] = ["articles", "news"];

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
      "A free, genuinely useful planner for the 70th Games (July 9–12): Filter the schedule, then get it back the way you need it. A downloadable, printable per-day itinerary, a field map with your stops pinned, arrive-by and between-event walk times, the right lot and shuttle fare, a live mountain forecast with packing list, and a calendar export. Everything the official schedule leaves you to figure out.",
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

// The standing pages, as opposed to the dated one-off reports above: surfaces
// that keep updating rather than ones published once. This is the "and Tools"
// half of the nav's "Reports and Tools", and it exists because both entries had
// gone nearly unreachable. The 2026-07-28 nav trim removed the header's
// "Road Conditions" link intending to rehome it here, but here was a hand-curated
// list it was never added to, so /roads spent three days with a single inbound
// link site-wide; /report-card, the franchise hub that gains a URL every graded
// month, was linked only from its own child. Anything standing goes in this list,
// not in the nav.
export const TOOLS: ReportEntry[] = [
  {
    title: "Road conditions in the High Country, graded daily",
    href: "/roads",
    summary:
      "A daily road-risk forecast for the High Country, from clear to hazardous, graded against what NCDOT and the Parkway actually reported. The rubric is on the page, so you can see why a day was called.",
  },
  {
    title: "The monthly Ray's Weather Report Card",
    href: "/report-card",
    summary:
      "One page per graded month, showing how each Boone forecaster did against verified actuals and how the running totals moved.",
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
    blurb: "What's new on Dave's Sweater: Features, fixes, and announcements.",
    description: "News and updates from Dave's Sweater: New features, scoring changes, and announcements.",
  },
  {
    // hidden: keeps the route + its posts working, but the category is left out
    // of the hub, the nav, and the hub OG card until there is a video to show
    // (owner, 2026-07-27: "we don't have any there and there's no need for a
    // holding spot"). Flip this off when the first video lands.
    key: "videos", label: "Videos", schemaName: "Videos", href: "/resources/videos", hidden: true,
    blurb: "The forecast, but with moving pictures.",
    description: "Weather videos from Dave's Sweater, Boone's most mostly reliable weather tracker.",
  },
  {
    key: "reports", label: "Reports and Tools", schemaName: "Reports and Tools", href: "/resources/reports",
    blurb: "Data deep-dives and the free tools built on them.",
    description: "Reports and tools from Dave's Sweater. Deep dives into Boone, NC forecast accuracy, plus the planners and trackers built on the same data.",
  },
] as const;

export type CategoryDef = (typeof CATEGORIES)[number];
