// Static share-card URLs + alt text — the single source of truth shared by the
// page `generateMetadata` functions and the build-time generator
// (`scripts/generate_og_images.mjs` → `scripts/og/cards.tsx`).
//
// WHY THESE ARE STATIC FILES AND NOT `opengraph-image.tsx` ROUTES:
// this repo deploys on Vercel Hobby, which caps a deployment at 12 Serverless
// Functions. Next emits exactly one Lambda per route directory containing a
// dynamic segment — and it does so whether or not the route is fully
// prerendered. `generateStaticParams`, `dynamicParams = false` and
// `dynamic = "force-static"` were all measured and none of them removes that
// Lambda. So a per-town `weather/[slug]/opengraph-image.tsx` costs a function
// no matter what, and ten such routes put the build 6 over the ceiling — which
// is exactly what froze production for a week in August 2026. Rendering the
// cards to files at build time costs zero functions. See CHECKLIST.md.
//
// Cards are generated from committed data that changes at most once a day, so
// there was never a reason to render them per request.
//
// There is no twitter:image counterpart anywhere on the site: we publish to
// LinkedIn, Instagram and Facebook, all of which read og:image, and X falls
// back to og:image when no twitter:image is declared. So the whole
// twitter-image.tsx family was retired rather than reproduced.

export const OG_DIMENSIONS = { width: 1200, height: 630 } as const;

/** Public URLs of the prerendered cards, relative to `metadataBase`. */
export const ogPath = {
  weather: (slug: string) => `/og/weather/${slug}.png`,
  tracker: (slug: string) => `/og/right-wrong-ray/${slug}.png`,
  resourceCategory: (category: string) => `/og/resources/${category}.png`,
  post: (category: string, slug: string) => `/og/resources/${category}/${slug}.png`,
  reportCard: (month: string) => `/og/report-card/${month}.png`,
  // Static routes get a plain path rather than a function: there is one card.
  leaf: "/og/leaf.png",
  tourism: "/og/tourism.png",
} as const;

/** Alt text, carried over verbatim from the retired image routes. */
export const ogAlt = {
  weather: "A real multi-source weather forecast, graded against the town's own actuals.",
  tracker:
    "Right Ray / Wrong Ray: daily forecast accuracy scores, graded against the town's own actuals.",
  resourceCategory: "Dave's Sweater resources: Articles, news, videos, and reports.",
  post: "A Dave's Sweater post: Boone weather, scored and published free.",
  reportCard:
    "A Dave's Sweater monthly report card: Boone forecast accuracy, scored and published free.",
  leaf:
    "Predicted peak fall color windows for the NC High Country, by elevation, graded against what happens.",
  tourism:
    "How busy Boone and the NC High Country will be, scored from lodging, events, and peak fall color.",
} as const;

/** Ready-made `openGraph.images` entry for a card. */
export function ogImage(url: string, alt: string) {
  return { url, alt, ...OG_DIMENSIONS };
}
