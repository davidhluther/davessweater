// Prerendered RSS 2.0 feeds — feed readers don't do query params well, so each
// town × horizon (and the verdict) is its own static XML file, built from the
// same committed JSON as the site. force-static + a fully enumerated
// generateStaticParams means these are baked at build (data read at build time,
// no request-time filesystem tracing needed); dynamicParams=false 404s anything
// not enumerated (an ungated town, a bad horizon).
//
// Routes:
//   /feed/{town}/forecast-{1|3|5}day.xml
//   /feed/{town}/verdict.xml
//   /feed/high-country/busyness.xml
// Enumerated for every town past the gate (Boone always).
//
// The Busy-ness Index is regional rather than per-town, so it is enumerated at
// the reserved slug "high-country" and nowhere else -- the URL says what the
// feed actually covers instead of pretending the index is Boone's alone. It
// rides this route rather than getting its own file because a route file is
// what costs a Serverless Function, and the budget is full.

export const dynamic = "force-static";
export const dynamicParams = false;

import { buildRss, forecastLine, LICENSE_NAME, LICENSE_URL, SITE_BASE, type RssItem } from "@/lib/publicFeed";
import { getBusynessIndex, weekdayLong } from "@/lib/tourism";
import { listPublicTowns, getTown, getTownForecast5, getTownComparison, latestComparisonDate } from "@/lib/towns";
import { stripDays } from "@/lib/forecast5";
import { fmtLongDate } from "@/lib/dates";

const HORIZONS = [1, 3, 5] as const;
/** Reserved slug for the region-wide feeds. Never a town. */
const REGION = "high-country";

export async function generateStaticParams() {
  const towns = await listPublicTowns();
  const params: { town: string; feed: string }[] = [];
  for (const t of towns) {
    for (const n of HORIZONS) params.push({ town: t.slug, feed: `forecast-${n}day.xml` });
    params.push({ town: t.slug, feed: "verdict.xml" });
  }
  params.push({ town: REGION, feed: "busyness.xml" });
  return params;
}

const XML_HEADERS = {
  "Content-Type": "application/rss+xml; charset=utf-8",
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
};

// Which feed a `[feed]` segment names, if any. Returns the forecast horizon, or
// "verdict", or null (unknown → 404).
function parseFeedToken(
  feed: string,
): { kind: "forecast"; days: number } | { kind: "verdict" } | { kind: "busyness" } | null {
  const m = feed.match(/^forecast-(1|3|5)day\.xml$/);
  if (m) return { kind: "forecast", days: Number(m[1]) };
  if (feed === "verdict.xml") return { kind: "verdict" };
  if (feed === "busyness.xml") return { kind: "busyness" };
  return null;
}

async function forecastFeed(slug: string, days: number): Promise<string> {
  const town = await getTown(slug);
  const name = town?.name ?? slug;
  const f5 = await getTownForecast5(slug);
  const strip = stripDays(f5, { max: days });
  const items: RssItem[] = strip.map((d) => ({
    title: `${weekdayLong(d.date)}, ${fmtLongDate(d.date)}: ${forecastLine(d)}`,
    link: `${SITE_BASE}/`,
    guid: `${slug}-forecast-${d.date}`,
    pubDate: new Date(d.date + "T12:00:00"),
    description: `${name} forecast for ${fmtLongDate(d.date)}: ${forecastLine(d)}. The Dave's Sweater Index (${d.count}-source consensus). Data licensed ${LICENSE_NAME} (${LICENSE_URL}).`,
  }));
  return buildRss({
    title: `Dave's Sweater | ${name} ${days}-day forecast`,
    link: `${SITE_BASE}/`,
    description: `The Dave's Sweater Index ${days}-day consensus forecast for ${name}, NC. Free, ${LICENSE_NAME}.`,
    selfUrl: `${SITE_BASE}/feed/${slug}/forecast-${days}day.xml`,
    items,
    lastBuildDate: new Date(),
  });
}

async function verdictFeed(slug: string): Promise<string> {
  const town = await getTown(slug);
  const name = town?.name ?? slug;
  const date = await latestComparisonDate(slug);
  const items: RssItem[] = [];
  if (date) {
    const comp = await getTownComparison(slug, date);
    if (comp) {
      const dave = comp.sources.composite?.score?.score ?? comp.sources.openmeteo?.score?.score ?? null;
      const rays = comp.sources.raysweather?.score?.score ?? null;
      const r = (n: number | null) => (n == null ? null : Math.round(n));
      const call =
        rays == null ? "Ray absent" : dave != null && dave > rays ? "Wrong Ray" : "Right Ray";
      const scoreline =
        rays == null
          ? `Dave's Sweater Index ${r(dave)}, Ray's has no station here`
          : `Dave's Sweater Index ${r(dave)}, Ray's ${r(rays)}`;
      items.push({
        title: `${fmtLongDate(date)}: ${scoreline}. ${call}`,
        link: `${SITE_BASE}/right-wrong-ray`,
        guid: `${slug}-verdict-${date}`,
        pubDate: new Date(date + "T12:00:00"),
        description: `${name}, ${fmtLongDate(date)}: ${scoreline}. ${call}. Scored against verified actual conditions. Data licensed ${LICENSE_NAME} (${LICENSE_URL}).`,
      });
    }
  }
  return buildRss({
    title: `Dave's Sweater | ${name} Right/Wrong Ray`,
    link: `${SITE_BASE}/right-wrong-ray`,
    description: `Yesterday's forecast-accuracy verdict for ${name}, NC. Every source scored against what actually happened. Free, ${LICENSE_NAME}.`,
    selfUrl: `${SITE_BASE}/feed/${slug}/verdict.xml`,
    items,
    lastBuildDate: new Date(),
  });
}

// One item per scored day in the current horizon. A reader subscribing to this
// wants to know which nights are worth avoiding, so the title carries the band
// and the score and the description carries the engine's own drivers verbatim,
// plus the provisional caveat while the index still has one.
async function busynessFeed(): Promise<string> {
  const indexFile = await getBusynessIndex();
  const items: RssItem[] = [];
  if (indexFile) {
    const { issued, index } = indexFile;
    const caveat = index.provisional && index.provisional_note ? ` ${index.provisional_note}` : "";
    for (const d of index.horizon) {
      const band = d.band.charAt(0).toUpperCase() + d.band.slice(1);
      const drivers = d.drivers.length ? d.drivers.join("; ") : "Nothing on the calendar";
      items.push({
        title: `${weekdayLong(d.date)}, ${fmtLongDate(d.date)}: ${band} (${Math.round(d.score)} of 100)`,
        link: `${SITE_BASE}/tourism`,
        // The score for a date changes as the date approaches, so the guid
        // carries the issue date too -- otherwise a reader would see the first
        // reading of a night and never the updated one.
        guid: `busyness-${issued}-${d.date}`,
        pubDate: new Date(d.date + "T12:00:00"),
        description: `How busy the NC High Country looks on ${fmtLongDate(d.date)}: ${band}, ${Math.round(d.score)} of 100. Drivers: ${drivers}.${caveat} Data licensed ${LICENSE_NAME} (${LICENSE_URL}).`,
      });
    }
  }
  return buildRss({
    title: "Dave's Sweater | High Country Busy-ness Index",
    link: `${SITE_BASE}/tourism`,
    description:
      "How crowded Boone and the NC High Country will be, scored daily two weeks out from hotel pricing, rental booking pace, events, and predicted peak fall color. Free, " +
      LICENSE_NAME + ".",
    selfUrl: `${SITE_BASE}/feed/${REGION}/busyness.xml`,
    items,
    lastBuildDate: new Date(),
  });
}

export async function GET(_request: Request, { params }: { params: Promise<{ town: string; feed: string }> }) {
  const { town, feed } = await params;
  const parsed = parseFeedToken(feed);
  if (!parsed) return new Response("Not found", { status: 404 });
  const xml =
    parsed.kind === "forecast"
      ? await forecastFeed(town, parsed.days)
      : parsed.kind === "verdict"
        ? await verdictFeed(town)
        : await busynessFeed();
  return new Response(xml, { headers: XML_HEADERS });
}
