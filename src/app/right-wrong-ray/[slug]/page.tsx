import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  allTowns, getTown, getTownScores, latestComparisonDate, getTownComparison,
  getTownForecast5, townTodayForecasts, scoredDays, firstScoredDate, isTownPublic,
} from "@/lib/towns";
import { ogAlt, ogImage, ogPath } from "@/lib/ogStatic";
import { sortScoredSources, townSparkSeries } from "@/lib/board";
import { scoreboardRows } from "@/lib/scoreboard";
import { rollingMean } from "@/lib/sparkline";
import { HEADLINE_SOURCES, isProvisional, MIN_SCORED_DAYS } from "@/lib/gating";
import { actualLines } from "@/lib/homeStats";
import { fmtLongDate } from "@/lib/dates";
import SectionBand from "@/components/SectionBand";
import SortableScoreTable, { type ScoreRow } from "@/components/SortableScoreTable";
import ScoredDayCard from "@/components/ScoredDayCard";
import UpcomingForecasts from "@/components/UpcomingForecasts";
import JsonLd from "@/components/JsonLd";

const BASE = "https://davessweater.com";

// Boone keeps the root /right-wrong-ray board. Every other registered town gets
// a sibling board on the identical 100-point rubric; provisional below the gate,
// ranked once it crosses — no per-town code.
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
  const card = ogImage(ogPath.tracker(slug), ogAlt.tracker);
  const title = `Right Ray / Wrong Ray: ${town.name}, NC forecast accuracy`;
  const description =
    `Daily accuracy scores for every ${town.name}, NC forecast, graded against ${town.name}'s own verified actuals on the same 100-point scale as Boone. Each town stands alone. No blended average.`;
  return {
    title,
    description,
    alternates: { canonical: `/right-wrong-ray/${slug}` },
    openGraph: {
      title: `Right Ray / Wrong Ray: ${town.name}`,
      description: `Who actually gets ${town.name}'s weather right? Every forecast graded daily against what happened.`,
      url: `${BASE}/right-wrong-ray/${slug}`,
      type: "website",
      images: [card],
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function TownTrackerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug === "boone") notFound();
  const town = await getTown(slug);
  if (!town) notFound();

  const [scores, latestDate, f5, isPublic] = await Promise.all([
    getTownScores(slug), latestComparisonDate(slug), getTownForecast5(slug), isTownPublic(slug),
  ]);
  const comp = latestDate ? await getTownComparison(slug, latestDate) : null;
  const today = townTodayForecasts(f5);
  const days = scoredDays(scores);
  const since = firstScoredDate(scores);

  // Season scoreboard: every source this town tracks, same rows as Boone. Spark
  // series is scoped per source (not to a Ray window) so no-Ray towns still trend.
  const allRows = scoreboardRows(scores);
  const spark = townSparkSeries(scores, allRows.map((r) => r.key));
  const rows: ScoreRow[] = allRows.map((r) => ({
    key: r.key,
    label: r.label,
    isFree: r.key !== "raysweather",
    own: r.key === "composite",
    record: r.record,
    avg: r.avg,
    days: r.days,
    spark: rollingMean(spark[r.key] ?? []),
  }));
  const provisionalKeys = new Set(
    allRows.filter((r) => isProvisional(r.days) && !HEADLINE_SOURCES.has(r.key)).map((r) => r.key)
  );

  // Day leaderboard: best first, best/worst badges land on one card each.
  const scored = sortScoredSources(comp);
  const bestScore = scored[0]?.e.score.score;
  const worstScore = scored[scored.length - 1]?.e.score.score;
  const markWorst = scored.length > 2 && worstScore !== bestScore;
  const hasRay = scored.some((s) => s.key === "raysweather");

  const a = comp?.actuals;
  const aLines = a ? actualLines(a) : [];
  const actualMain = aLines.slice(0, 3).join(" | ");
  const actualCond = aLines[3];

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": BASE },
        { "@type": "ListItem", "position": 2, "name": "Right Ray / Wrong Ray", "item": `${BASE}/right-wrong-ray` },
        { "@type": "ListItem", "position": 3, "name": town.name, "item": `${BASE}/right-wrong-ray/${slug}` },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "Dataset",
      "name": `${town.name}, NC forecast accuracy scores`,
      "description":
        `Daily accuracy scores comparing every forecast we track for ${town.name}, NC against verified actual conditions on a 100-point scale.`,
      "creator": { "@type": "Organization", "name": "Dave's Sweater", "url": BASE },
      "isAccessibleForFree": true,
      "license": "https://creativecommons.org/licenses/by/4.0/",
      "url": `${BASE}/right-wrong-ray/${slug}`,
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

      {/* No town control in this hero: it mirrors the canonical Boone board,
          whose town band moved into the header picker on 2026-07-28 so the
          control exists exactly once (owner, 2026-07-28). */}
      <section className="w-full bg-teal-700 text-white">
        <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-12">
          <div className="ds-kicker text-orange-300">
            {isPublic ? `${days} days on the record` : `Tracking since ${since ? fmtLongDate(since) : "recently"} | ${days} of ${MIN_SCORED_DAYS} days`}
          </div>
          <h1 className="mt-1 ds-h1">
            Right Ray / Wrong Ray <span className="text-white/60">|</span> {town.name}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/70">
            Every forecast for {town.name} is a claim about tomorrow. This board grades each one we track
            against what the sky actually did, on the same rubric as Boone. {town.name} stands alone here:
            no blended average, no borrowed scores.
          </p>
          <p className="mt-5 flex flex-wrap gap-3">
            {hasRay && (
              <a href="#rays-latest"
                className="inline-flex min-h-10 items-center rounded-lg bg-orange-600 px-4 text-sm font-bold text-white transition-colors hover:bg-[#9a3412]">
                How Ray did &darr;
              </a>
            )}
            <Link href={`/weather/${slug}`}
              className="inline-flex min-h-10 items-center rounded-lg border border-white/30 px-4 text-sm font-bold text-white transition-colors hover:bg-white/10">
              {town.name}&apos;s forecast
            </Link>
          </p>
        </div>
      </section>

      {!isPublic && (
        <section className="w-full bg-amber-50 text-amber-900">
          <div className="mx-auto w-full max-w-3xl px-4 py-4 text-sm">
            <span className="font-semibold">This board is provisional.</span>{" "}
            {town.name} has {days} of {MIN_SCORED_DAYS} scored days. The numbers below are real, just early.
            They graduate to an established record once the count crosses {MIN_SCORED_DAYS}, the same gate
            every source on the site clears.
          </div>
        </section>
      )}

      {rows.length > 0 && (
        <section className="w-full bg-teal-900 text-white [background-image:radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:22px_22px]">
          <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10">
            <h2 className="mb-1 ds-h2">{town.name} Scoreboard</h2>
            <p className="mb-4 text-sm text-white/70">
              Every forecaster we track for {town.name}, ranked by average. Our own{" "}
              <span className="font-semibold text-white/90">Dave&apos;s Sweater Index</span> (marked{" "}
              <span className="font-semibold text-emerald-300">ours</span>) is graded right in the mix.
            </p>
            <SortableScoreTable rows={rows} />
            <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/70">
              <div className="flex items-center gap-1.5"><dt className="font-semibold text-white">R</dt><dd>Right, 75+</dd></div>
              <div className="flex items-center gap-1.5"><dt className="font-semibold text-white">M</dt><dd>Meh, 60 to 74</dd></div>
              <div className="flex items-center gap-1.5"><dt className="font-semibold text-white">W</dt><dd>Wrong, under 60</dd></div>
              <div className="flex items-center gap-1.5"><dt className="font-semibold text-white">Trend</dt><dd>7-day rolling average</dd></div>
            </dl>
          </div>
        </section>
      )}

      <SectionBand tone="surface">
        {comp ? (
          <>
            <h2 className="ds-h2">
              Latest scored day{comp.date ? <span className="text-muted"> | {fmtLongDate(comp.date)}</span> : null}
            </h2>
            <p className="mt-1 ds-body text-muted">
              {town.name}&apos;s forecasts, graded against what the sky actually did. The math is under each score.
            </p>

            {a && (
              <div className="mt-4 rounded-2xl bg-teal-900 p-5 text-white sm:p-6 [background-image:radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:22px_22px]">
                <div className="ds-kicker text-white/60">
                  What actually happened
                </div>
                <div className="mt-1.5 ds-stat">{actualMain}</div>
                {actualCond && <div className="mt-1 text-sm text-white/70">{actualCond}</div>}
              </div>
            )}

            {scored.map((s, i) => (
              <ScoredDayCard
                key={s.key}
                source={s}
                isBest={i === 0 && scored.length >= 2}
                isWorst={markWorst && i === scored.length - 1}
                anchorId={s.key === "raysweather" ? "rays-latest" : undefined}
              />
            ))}
          </>
        ) : <p className="text-muted">No comparison yet.</p>}
        <p className="mt-5 text-xs italic text-muted">
          Each forecast is scored out of 100 across four fields, by closeness to the actual recorded
          conditions. Those fields are high temp (30), low temp (30), wind (20, scored as a range when the
          source gives one) and precipitation (20, form and amount graded together, snow-aware). Same rubric
          for every town.
        </p>
        {hasRay && (
          <p className="mt-2 text-xs italic text-muted">
            Ray&apos;s Weather publishes a per-town high, low and sky icon, so his town boards are graded on
            those. The icon is read as his precipitation call (a dry icon scores as a no-rain forecast, a
            rain or storm icon as rain). His wind text is one identical regional string across every town, so
            wind stays an honest forfeit here rather than a stamped guess. See the{" "}
            <Link href="/methodology#locations" className="text-teal underline underline-offset-2">methodology</Link>{" "}
            for the icon mapping.
          </p>
        )}
        <p className="mt-2 text-xs">
          <Link href="/methodology" className="text-teal underline underline-offset-2">Full methodology</Link>
          {" | "}
          <Link href="/right-wrong-ray" className="text-teal underline underline-offset-2">Boone&apos;s board</Link>
        </p>
      </SectionBand>

      {today && (
        <SectionBand tone="light">
          <h2 className="mb-1 ds-h2">What they&apos;re predicting for {town.name}</h2>
          <UpcomingForecasts data={today} provisional={provisionalKeys} />
        </SectionBand>
      )}
    </>
  );
}
