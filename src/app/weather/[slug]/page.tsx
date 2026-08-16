import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  allTowns, getTown, getTownForecast5, getTownScores,
  townTodayForecasts, scoredDays, firstScoredDate, isTownPublic,
} from "@/lib/towns";
import { ogAlt, ogImage, ogPath } from "@/lib/ogStatic";
import { compositeForecast } from "@/lib/composite";
import { sweaterFromEffective } from "@/lib/sweater";
import { MIN_SCORED_DAYS } from "@/lib/gating";
import { fmtLongDate } from "@/lib/dates";
import SectionBand from "@/components/SectionBand";
import CompositeHeadline from "@/components/CompositeHeadline";
import FiveDayStrip from "@/components/FiveDayStrip";
import UpcomingForecasts from "@/components/UpcomingForecasts";
import JsonLd from "@/components/JsonLd";

const BASE = "https://davessweater.com";

// Boone keeps `/` — there is deliberately no /weather/boone twin (we just fixed a
// duplicate-canonical mess and won't mint another). Every other registered town
// gets a statically-prerendered page; they render provisional below the gate and
// cross to a full record automatically, no per-town code.
export async function generateStaticParams() {
  const towns = await allTowns();
  return towns.filter((t) => t.slug !== "boone").map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const town = await getTown(slug);
  if (!town || slug === "boone") return {};
  // Prerendered share card (public/og/...), not an opengraph-image route: a
  // dynamic-segment image route costs a Serverless Function against the Vercel
  // Hobby cap of 12. See src/lib/ogStatic.ts.
  const card = ogImage(ogPath.weather(slug), ogAlt.weather);
  const title = `${town.name}, NC weather: Multi-source forecast, graded`;
  const description =
    `The forecast for ${town.name}, NC from every source we track, blended into one consensus and graded daily against ${town.name}'s own actuals. Its own data at its own coordinates, not a stamped regional copy.`;
  return {
    title,
    description,
    alternates: { canonical: `/weather/${slug}` },
    openGraph: {
      title: `${town.name}, NC weather`,
      description: `A real ${town.name} forecast: multiple sources, one consensus, graded against ${town.name}'s own actuals.`,
      url: `${BASE}/weather/${slug}`,
      type: "website",
      images: [card],
    },
    twitter: { card: "summary_large_image" },
  };
}

// One row of sweater glyphs, dimmed past the day's count — same treatment as the
// homepage strip.
function sweaterIcons(score: number) {
  return Array.from({ length: 5 }, (_, i) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img key={i} src="/assets/sweateremoji.webp" alt=""
      className={i < score ? "inline h-5 w-5" : "inline h-5 w-5 opacity-25 grayscale"} />
  ));
}

export default async function TownWeatherPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug === "boone") notFound();
  const town = await getTown(slug);
  if (!town) notFound();

  const [f5, scores, isPublic] = await Promise.all([
    getTownForecast5(slug), getTownScores(slug), isTownPublic(slug),
  ]);
  const today = townTodayForecasts(f5);
  const composite = compositeForecast(today);
  const days = scoredDays(scores);
  const since = firstScoredDate(scores);
  const sweater = composite ? sweaterFromEffective(composite.high) : null;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": BASE },
        { "@type": "ListItem", "position": 2, "name": "Weather", "item": `${BASE}/weather` },
        { "@type": "ListItem", "position": 3, "name": town.name, "item": `${BASE}/weather/${slug}` },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "Dataset",
      "name": `${town.name}, NC forecast accuracy scores`,
      "description":
        `Daily multi-source forecasts for ${town.name}, NC (elevation ${town.elevation_ft} ft), each graded against ${town.name}'s own verified actual conditions on a 100-point scale.`,
      "creator": { "@type": "Organization", "name": "Dave's Sweater", "url": BASE },
      "isAccessibleForFree": true,
      "license": "https://creativecommons.org/licenses/by/4.0/",
      "url": `${BASE}/weather/${slug}`,
      "spatialCoverage": {
        "@type": "Place",
        "name": `${town.name}, NC`,
        "geo": { "@type": "GeoCoordinates", "latitude": town.lat, "longitude": town.lon },
      },
    },
  ];

  return (
    <>
      <JsonLd data={jsonLd} />

      {/* Hero band — same teal dialect as the tracker header. No town control
          here: this page mirrors the canonical Boone page, whose in-hero band
          moved into the header picker on 2026-07-28 so the site has exactly one
          place to switch town (owner, 2026-07-28: "the pills on the towns are
          still in the hero, these new town pages are supposed to mirror the
          canon Boone page"). */}
      <section className="w-full bg-teal-700 text-white">
        <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-12">
          <div className="ds-kicker text-orange-300">
            {town.county ? `${town.county} County` : "High Country"} | {town.elevation_ft.toLocaleString()} ft
          </div>
          <h1 className="mt-1 ds-h1">{town.name} weather</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/70">
            A real {town.name} forecast, not a stamped regional copy. Every source we track, pulled at{" "}
            {town.name}&apos;s own coordinates, blended into one consensus and graded daily against{" "}
            {town.name}&apos;s own actuals.
          </p>
        </div>
      </section>

      {/* Provisional disclosure: shown, not hidden — the board is real, just early */}
      {!isPublic && (
        <section className="w-full bg-amber-50 text-amber-900">
          <div className="mx-auto w-full max-w-3xl px-4 py-4 text-sm">
            <span className="font-semibold">Tracking since {since ? fmtLongDate(since) : "recently"}</span>
            {" | "}{days} of {MIN_SCORED_DAYS} scored days. The forecast below is live now; the accuracy
            record opens once {town.name} crosses {MIN_SCORED_DAYS} graded days.
          </div>
        </section>
      )}

      <SectionBand>
        <div className="mx-auto flex max-w-2xl flex-col gap-4 sm:gap-5">
          {composite ? (
            <div className="rounded-2xl border border-border bg-surface px-4 py-6 sm:px-8 sm:py-8">
              {/* Today's consensus — the Dave's Sweater Index at this town's
                  coordinates, rendered by the same component as the homepage */}
              <CompositeHeadline composite={composite} />

              {sweater && (
                <>
                  <div className="my-6 border-t border-border" />
                  <h2 className="mb-3 text-center ds-h3">Sweater Weather Index</h2>
                  <div className="text-center">
                    <div className="flex justify-center gap-0.5" role="img" aria-label={`${sweater.score} of 5 sweaters`}>
                      {sweaterIcons(sweater.score)}
                    </div>
                    <p className="mx-auto mt-3 max-w-md text-sm font-medium text-foreground">{sweater.verdict}</p>
                    <p className="mt-1 ds-caption">Layers to consider: {sweater.layers}</p>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-surface px-4 py-6 text-center ds-body text-muted sm:px-8 sm:py-8">
              Forecast capture for {town.name} is just getting started. Check back shortly.
            </div>
          )}

          <div className="rounded-2xl border border-border bg-surface px-4 py-6 sm:px-8 sm:py-8">
            <FiveDayStrip data={f5} scoreboardHref={`/right-wrong-ray/${slug}`} />
          </div>
        </div>
      </SectionBand>

      {today && (
        <SectionBand tone="light">
          <h2 className="mb-1 ds-h2">What they&apos;re predicting for {town.name}</h2>
          <UpcomingForecasts data={today} />
          <p className="mt-4 ds-body text-muted">
            See how each of these did once the day is in the books:{" "}
            <Link href={`/right-wrong-ray/${slug}`} className="text-teal underline underline-offset-2">
              {town.name}&apos;s accuracy board
            </Link>
            {" | "}
            <Link href="/methodology" className="text-teal underline underline-offset-2">How we grade</Link>
          </p>
        </SectionBand>
      )}
    </>
  );
}
