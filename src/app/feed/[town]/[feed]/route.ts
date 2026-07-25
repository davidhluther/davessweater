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
// Enumerated for every town past the gate (Boone always).

export const dynamic = "force-static";
export const dynamicParams = false;

import { buildRss, forecastLine, LICENSE_NAME, LICENSE_URL, SITE_BASE, type RssItem } from "@/lib/publicFeed";
import { listPublicTowns, getTown, getTownForecast5, getTownComparison, latestComparisonDate } from "@/lib/towns";
import { stripDays } from "@/lib/forecast5";
import { fmtLongDate } from "@/lib/dates";

const HORIZONS = [1, 3, 5] as const;

export async function generateStaticParams() {
  const towns = await listPublicTowns();
  const params: { town: string; feed: string }[] = [];
  for (const t of towns) {
    for (const n of HORIZONS) params.push({ town: t.slug, feed: `forecast-${n}day.xml` });
    params.push({ town: t.slug, feed: "verdict.xml" });
  }
  return params;
}

const XML_HEADERS = {
  "Content-Type": "application/rss+xml; charset=utf-8",
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
};

function weekdayLong(date: string): string {
  return new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" });
}

// Which feed a `[feed]` segment names, if any. Returns the forecast horizon, or
// "verdict", or null (unknown → 404).
function parseFeedToken(feed: string): { kind: "forecast"; days: number } | { kind: "verdict" } | null {
  const m = feed.match(/^forecast-(1|3|5)day\.xml$/);
  if (m) return { kind: "forecast", days: Number(m[1]) };
  if (feed === "verdict.xml") return { kind: "verdict" };
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
    description: `${name} forecast for ${fmtLongDate(d.date)} — ${forecastLine(d)}. The Dave's Sweater Index (${d.count}-source consensus). Data licensed ${LICENSE_NAME} (${LICENSE_URL}).`,
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
        title: `${fmtLongDate(date)}: ${scoreline} — ${call}`,
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
    description: `Yesterday's forecast-accuracy verdict for ${name}, NC — every source scored against what actually happened. Free, ${LICENSE_NAME}.`,
    selfUrl: `${SITE_BASE}/feed/${slug}/verdict.xml`,
    items,
    lastBuildDate: new Date(),
  });
}

export async function GET(_request: Request, { params }: { params: Promise<{ town: string; feed: string }> }) {
  const { town, feed } = await params;
  const parsed = parseFeedToken(feed);
  if (!parsed) return new Response("Not found", { status: 404 });
  const xml = parsed.kind === "forecast" ? await forecastFeed(town, parsed.days) : await verdictFeed(town);
  return new Response(xml, { headers: XML_HEADERS });
}
