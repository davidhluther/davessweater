import type { Metadata } from "next";
import Link from "next/link";
import SectionBand from "@/components/SectionBand";
import JsonLd from "@/components/JsonLd";
import LeafSeasonStrip from "@/components/LeafSeasonStrip";
import LeafTownTable from "@/components/LeafTownTable";
import { fmtLongDate } from "@/lib/dates";
import { ogAlt, ogImage, ogPath } from "@/lib/ogStatic";
import {
  fmtPeakWindow,
  getLeafGradingSources,
  getLeafPredictions,
  getLeafScoreboard,
  hasThermalSignal,
  lapseRatePerThousandFt,
  leafBandRows,
  leafBookends,
  leafByPeak,
  leafSeasonSpan,
} from "@/lib/leaf";

// The cross-town fall-color hub. Static route, no dynamic segment, no route
// handler: this repo deploys on Vercel Hobby with a hard 12-Serverless-Function
// cap and was already sitting at its budget of 10 when this page was built.
// Everything here is read from committed JSON at build time. The share card is
// a prerendered file under public/og (scripts/og/cards.tsx), not an
// opengraph-image route, for the same reason.
//
// Division of labor with the town pages: /weather/[slug] carries that town's own
// window and the arithmetic behind it; this page carries the gradient across all
// of them plus the methodology. They deliberately do not compete for the same
// query.

const URL = "https://davessweater.com/leaf";

export const metadata: Metadata = {
  title: "When leaves peak in the NC High Country",
  description:
    "Predicted peak fall color windows for 18 High Country towns, from Beech Mountain at 5,436 feet down to the Wilkes County valleys near 1,000. Built from elevation and temperature, published free, graded against what actually happens.",
  alternates: { canonical: "/leaf" },
  openGraph: {
    title: "When leaves peak in the NC High Country | Dave's Sweater",
    description:
      "Peak fall color windows for 18 towns across 4,400 feet of elevation. Our own model, its arithmetic shown, graded in October against the published color reports.",
    url: URL,
    type: "website",
    images: [ogImage(ogPath.leaf, ogAlt.leaf)],
  },
};

export default async function LeafPage() {
  const [data, sources, board] = await Promise.all([
    getLeafPredictions(),
    getLeafGradingSources(),
    getLeafScoreboard(),
  ]);

  const predictions = leafByPeak(data?.predictions ?? []);
  const span = leafSeasonSpan(predictions);
  const bands = leafBandRows(predictions);
  const bookends = leafBookends(predictions);

  // The model has not been run for this repo. Say so rather than render an
  // empty table that looks like an answer.
  if (!data || !span || !bookends) {
    return (
      <SectionBand tone="surface">
        <h1 className="ds-h1">High Country fall color</h1>
        <p className="mt-2 max-w-2xl ds-body text-muted">
          The peak color forecast is not available right now. The model runs against our own
          temperature history and writes its windows to a file this page reads, and that file is
          missing, so there is nothing honest to show you.
        </p>
      </SectionBand>
    );
  }

  const first = bookends.first;
  const last = bookends.last;
  const boone = predictions.find((p) => p.slug === "boone");
  const anyThermal = predictions.some(hasThermalSignal);
  const rate = predictions.map(lapseRatePerThousandFt).find((r) => r !== null) ?? 6.5;
  const refElev = predictions[0].components.reference_elevation_ft.toLocaleString();
  const refDate = predictions[0].components.reference_date;
  const halfWindow = predictions[0].components.half_window_days;
  const scored = board?.summary.scored_rows ?? 0;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "When leaves peak in the NC High Country",
      "description": `Predicted peak fall color windows for ${predictions.length} High Country towns, built from elevation and temperature and graded against observed color reports.`,
      "url": URL,
      "isAccessibleForFree": true,
      "publisher": { "@type": "Organization", "name": "Dave's Sweater", "url": "https://davessweater.com" },
      "mainEntityOfPage": URL,
      "dateModified": data.generated_at,
    },
    {
      "@context": "https://schema.org",
      "@type": "Dataset",
      "name": `High Country peak fall color windows, ${data.target_year}`,
      "description": `One predicted peak color window per tracked town, ${predictions.length} places spanning ${last.elevation_ft.toLocaleString()} to ${first.elevation_ft.toLocaleString()} feet, with the elevation and temperature components behind each date.`,
      "url": URL,
      "license": "https://creativecommons.org/licenses/by/4.0/",
      "isAccessibleForFree": true,
      "creator": { "@type": "Organization", "name": "Dave's Sweater", "url": "https://davessweater.com" },
      "temporalCoverage": `${span.start}/${span.end}`,
      "spatialCoverage": { "@type": "Place", "name": "North Carolina High Country" },
      "dateModified": data.generated_at,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://davessweater.com" },
        { "@type": "ListItem", "position": 2, "name": "Fall color", "item": URL },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        ...(boone
          ? [{
              "@type": "Question",
              "name": "When do the leaves peak in Boone, NC?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": `Our model puts peak color in Boone, at ${boone.elevation_ft.toLocaleString()} feet, around ${fmtPeakWindow(boone.peak_start, boone.peak_end)}, ${data.target_year}. Higher ground turns first: ${first.name} at ${first.elevation_ft.toLocaleString()} feet is predicted to peak ${fmtPeakWindow(first.peak_start, first.peak_end)}.`,
              },
            }]
          : []),
        {
          "@type": "Question",
          "name": "Why does fall color arrive at different times in different High Country towns?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": `Elevation. Higher ground cools sooner, so it turns sooner, and the color front descends about ${rate} days later for every 1,000 feet it drops. Across the ${predictions.length} towns we track, that spreads peak color over ${span.days} days.`,
          },
        },
        {
          "@type": "Question",
          "name": "How accurate is this fall color forecast?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Unproven, and we say so. This is the model's first live fall. It reproduces the documented elevation gradient in a 2024 and 2025 hindcast, but that does not establish it can tell a warm year from a cool one. In October we score every window against the published fall color reports and publish the result, flattering or not.",
          },
        },
      ],
    },
  ];

  return (
    <>
      <JsonLd data={jsonLd} />

      <SectionBand tone="surface">
        <div className="ds-kicker text-orange-600">Fall color forecast</div>
        <h1 className="mt-1 ds-h1">When the leaves peak in the High Country</h1>
        <p className="mt-3 max-w-2xl ds-body text-muted">
          Peak color does not arrive here on a date. It arrives on a staircase, and the steps are
          made of elevation. We already track {predictions.length} places, from {first.name} at{" "}
          {first.elevation_ft.toLocaleString()} feet down to the Wilkes County valleys near{" "}
          {last.elevation_ft.toLocaleString()}, with a daily temperature record for each one. So we
          built a model that turns that spread into {predictions.length} separate predictions, and
          we publish them free.
        </p>
        <p className="mt-4 ds-stat text-orange-600">
          {fmtPeakWindow(first.peak_start, first.peak_end)} to{" "}
          {fmtPeakWindow(last.peak_start, last.peak_end)}
        </p>
        <p className="mt-1 ds-caption">
          {first.name} peaks first, {last.name} last, fall {data.target_year}
        </p>
      </SectionBand>

      <SectionBand>
        <h2 className="ds-h2">The season, one band at a time</h2>
        <p className="mt-2 max-w-2xl ds-body text-muted">
          The exposed ground above 5,000 feet turns while the valleys are still green, and the front
          works downhill from there over the next {span.days} days. If you are chasing color, this
          is the whole trip planner. Pick the band, not the weekend.
        </p>
        <LeafSeasonStrip span={span} bands={bands} />
      </SectionBand>

      <SectionBand tone="surface">
        <h2 className="ds-h2">Every town we track</h2>
        <p className="mt-2 max-w-2xl ds-body text-muted">
          Earliest peak first. Each town links to its own page, where the same window sits beside
          that town&apos;s actual forecast with the arithmetic that produced it.
        </p>
        <LeafTownTable predictions={predictions} />
        <p className="mt-4 ds-caption">
          Model {data.model_version} <span className="mx-1">|</span> Generated{" "}
          {fmtLongDate(data.generated_at.slice(0, 10))}
        </p>
      </SectionBand>

      <SectionBand tone="dark">
        <div className="ds-kicker text-orange-300">Methodology</div>
        <h2 className="mt-1 ds-h2">How we get a date</h2>
        <p className="mt-3 ds-body text-white/70">
          Three ingredients, in order of how much they move the answer. All of it is arithmetic you
          can check by hand, which is the point.
        </p>

        <h3 className="mt-6 ds-h3">1. Daylength sets the clock</h3>
        <p className="mt-2 ds-body text-white/70">
          What triggers senescence, the shutdown of chlorophyll that lets the yellows and reds show,
          is mostly how much daylight a tree is still getting. Daylength on a given calendar date is
          identical year to year, so the base timing is fixed. We encode it as one anchor: peak color
          at {refElev} feet lands in the first week of October, and we pin it to {fmtLongDate(refDate)}.
        </p>

        <h3 className="mt-6 ds-h3">2. Elevation sets the gradient</h3>
        <p className="mt-2 ds-body text-white/70">
          Higher ground cools sooner and turns sooner. The documented pattern here is a color front
          descending roughly 1,000 to 1,500 feet a week. We use {rate} days per 1,000 feet of drop,
          which also fits the observed gap between Grandfather Mountain in early October and Boone
          in the middle of it. This is the dominant term, and the one you can check against any two
          rows of the table above.
        </p>

        <h3 className="mt-6 ds-h3">3. Temperature nudges it</h3>
        <p className="mt-2 ds-body text-white/70">
          A warm early autumn delays the shutdown. A cold snap hurries it along. We compare each
          town&apos;s September temperatures against that town&apos;s own normal from the prior six
          years, and shift the peak 1.5 days per degree, hard-clamped to a week in either direction.
          The clamp is deliberate. Daylight and elevation own the prediction. Temperature only
          nudges.
        </p>
        <p className="mt-3 ds-body text-white/70">
          {anyThermal ? (
            <>
              This fall&apos;s September temperatures are in, so the windows above carry a real
              anomaly reading rather than climatology alone.
            </>
          ) : (
            <>
              <strong className="text-white">That third term is switched off right now.</strong>{" "}
              September {data.target_year} has not accrued enough days to read, so every window
              above is elevation and climatology only, and these dates will move once the
              temperature term comes on. We would rather show you the gap than paper over it.
            </>
          )}
        </p>
        <p className="mt-3 ds-body text-white/70">
          The window itself is the predicted center plus or minus {halfWindow} days. Peak is a
          stretch, not an instant.
        </p>
      </SectionBand>

      <SectionBand>
        <h2 className="ds-h2">What this model cannot do</h2>
        <p className="mt-2 max-w-2xl ds-body text-muted">
          Run against 2024 and 2025, every elevation band landed inside its predicted window, and
          the high and middle bands landed within a day or two of center. Read that for exactly what
          it is: confirmation that the model reproduces the documented elevation gradient. It is not
          confirmation that the model can tell a warm year from a cool one, day for day, because the
          published reports describe the season in the same language every year and never give a
          dated calendar peak. That test needs graded seasons, and this is the first one.
        </p>
        <ul className="mt-4 max-w-2xl space-y-2 ds-body text-muted">
          <li>
            <strong className="text-foreground">The gradient is a straight line.</strong> Real color
            fronts bend with slope and aspect. A north-facing cove turns before a south-facing ridge
            at the same elevation, and none of that is in here.
          </li>
          <li>
            <strong className="text-foreground">Species are ignored.</strong>{" "}
            Maples, poplars, oaks, and birches peak on different schedules, and a town&apos;s
            dominant species shifts its real peak.
          </li>
          <li>
            <strong className="text-foreground">
              The temperature coefficient is a first guess.
            </strong>{" "}
            September mean temperature stands in for the real drivers, which are cool nights, sunny
            days, first frost, and drought stress. That number gets corrected by grading, not by
            argument.
          </li>
          <li>
            <strong className="text-foreground">Ground truth is a judgment call.</strong> No station
            reports a peak color number. Grading means reading photo galleries and written reports
            by eye, which is softer than scoring a temperature against an archive, and we are not
            going to pretend otherwise.
          </li>
        </ul>
      </SectionBand>

      <SectionBand tone="surface">
        <div className="ds-kicker text-orange-600">Grading</div>
        <h2 className="mt-1 ds-h2">Then we check ourselves</h2>
        <p className="mt-2 max-w-2xl ds-body text-muted">
          Every forecast on this site is a claim, and a peak color window is a claim about October.
          The scoring rules were written and tested in July, before a single observation existed, so
          nothing gets graded on a curve after the fact: full credit within three days of the
          observed peak, then six points off per day, on the same Right and Wrong bands the weather
          scores use. Starting the week of September 21 we read the published color reports every
          Monday and record what they say.
        </p>
        {scored > 0 && board ? (
          <>
            <p className="mt-4 ds-stat text-orange-600">{board.summary.mean_score}</p>
            <p className="mt-1 ds-caption">
              Mean score across {board.summary.towns_scored}{" "}
              {board.summary.towns_scored === 1 ? "town" : "towns"}, fall {data.target_year}
            </p>
            <p className="mt-3 max-w-2xl ds-body text-muted">
              Our windows caught the observed peak{" "}
              {Math.round((board.summary.window_hit_rate ?? 0) * 100)}% of the time, and the average
              call ran {Math.abs(board.summary.mean_signed_error_days ?? 0).toFixed(1)} days{" "}
              {(board.summary.mean_signed_error_days ?? 0) > 0 ? "late" : "early"}. The direction is
              the number that matters. It is the only honest reason to change a constant next year.
            </p>
          </>
        ) : (
          <p className="mt-4 max-w-2xl ds-body text-muted">
            Nothing is scored yet. The leaves have not turned. When they do, the results land here
            whether or not they flatter the model.
          </p>
        )}
        {sources.length ? (
          <>
            <h3 className="mt-6 ds-h3">What we grade against</h3>
            <ul className="mt-3 max-w-2xl space-y-2 ds-body text-muted">
              {sources.map((s) => (
                <li key={s.id}>
                  <a
                    href={s.url}
                    rel="nofollow noopener"
                    className="text-foreground underline underline-offset-2"
                  >
                    {gradingSourceLabel(s.id)}
                  </a>
                  . {gradingSourceRole(s.id)}
                </li>
              ))}
            </ul>
            <p className="mt-3 ds-caption">
              All three are human-judged reports, not data feeds, which is why we read them rather
              than scrape them.
            </p>
          </>
        ) : null}
      </SectionBand>

      <SectionBand>
        <h2 className="ds-h2">Why we bothered</h2>
        <p className="mt-2 max-w-2xl ds-body text-muted">
          The data behind a leaf forecast is elevation and temperature. Both are public, and we were
          already collecting the second one every morning for {predictions.length} places. So the
          only thing standing between you and a per-town peak color forecast was somebody writing
          the arithmetic down and agreeing to be graded on it. That is the whole site, really.{" "}
          <Link href="/methodology" className="text-foreground underline underline-offset-2">
            The same goes for how we score the weather
          </Link>
          .
        </p>
      </SectionBand>
    </>
  );
}

// The registry holds each grading source's URL and an operator note. The note is
// internal shorthand, so the reader-facing name and role are written here rather
// than dumping an ops comment onto the page.
function gradingSourceLabel(id: string): string {
  const labels: Record<string, string> = {
    "fall-color-grandfather": "Grandfather Mountain's dated fall color gallery",
    "fall-color-highcountryhost": "High Country Host's NC mountains color report",
    "fall-color-wataugaonline": "WataugaOnline's fall color report",
  };
  return labels[id] ?? id;
}

function gradingSourceRole(id: string): string {
  const roles: Record<string, string> = {
    "fall-color-grandfather":
      "The high-elevation leading indicator, above 5,000 feet, where color turns first.",
    "fall-color-highcountryhost":
      "The regional weekly, reported by elevation band across the whole footprint.",
    "fall-color-wataugaonline": "The Boone-elevation check, closest to where most readers live.",
  };
  return roles[id] ?? "";
}
