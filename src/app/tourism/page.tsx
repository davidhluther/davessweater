import type { Metadata } from "next";
import Link from "next/link";
import SectionBand from "@/components/SectionBand";
import JsonLd from "@/components/JsonLd";
import BusynessCalendar from "@/components/BusynessCalendar";
import BusynessHorizon from "@/components/BusynessHorizon";
import WeekendRateTrend from "@/components/WeekendRateTrend";
import { fmtLongDate } from "@/lib/dates";
import { ogAlt, ogImage, ogPath } from "@/lib/ogStatic";
import {
  crossConfirmation,
  eventOverlay,
  getAthleticsNames,
  getBusynessArchiveSpan,
  getBusynessIndex,
  getBusynessObservations,
  getLodgingCapture,
  getLodgingCaptures,
  getRegistryEvents,
  heatCalendarDays,
  median,
  rateObservations,
  upcomingWeekend,
  vsTypical,
  weekdayLong,
  weekendRateSeries,
  type BusynessBand,
} from "@/lib/tourism";

// The public Busy-ness Index. Static route, no dynamic segment, no route
// handler: this repo deploys on Vercel Hobby with a hard 12-Serverless-Function
// cap and was sitting at its budget of 10 when this page was built. Everything
// here is read from committed JSON at build time, and the share card is a
// prerendered file under public/og rather than an opengraph-image route, for
// the same reason. The JSON API lives inside the existing /api/v1/[endpoint]
// catch-all and the feed inside the existing /feed route, so neither adds one
// either. See scripts/check_function_budget.py.

const URL = "https://davessweater.com/tourism";
const CALENDAR_DAYS = 30;
/** Lead time the weekend rate series is read at. Every bar is matched to it. */
const RATE_LEAD = 3;

const BAND_COPY: Record<BusynessBand, string> = {
  calm: "Calm",
  typical: "Typical",
  busy: "Busy",
  slammed: "Slammed",
};

const BAND_TONE: Record<BusynessBand, string> = {
  calm: "text-muted",
  typical: "text-foreground",
  busy: "text-orange-600",
  slammed: "text-orange-600",
};

export const metadata: Metadata = {
  title: "How busy will Boone be? The High Country Busy-ness Index",
  description:
    "A scored, free forecast of how crowded Boone and the NC High Country will be, two weeks out. Built from hotel pricing, short-term-rental booking pace, the event calendar, and our own peak fall color model, with the whole formula shown.",
  alternates: { canonical: "/tourism" },
  openGraph: {
    title: "How busy will Boone be? | Dave's Sweater",
    description:
      "The High Country Busy-ness Index: hotel pricing, rental booking pace, events, and peak leaf color, scored into one number two weeks out. Free, and the math is on the page.",
    url: URL,
    type: "website",
    images: [ogImage(ogPath.tourism, ogAlt.tourism)],
  },
};

export default async function TourismPage() {
  const [indexFile, lodging, captures, observations, archive, registry, athletics] =
    await Promise.all([
      getBusynessIndex(),
      getLodgingCapture(),
      getLodgingCaptures(),
      getBusynessObservations(),
      getBusynessArchiveSpan(),
      getRegistryEvents(),
      getAthleticsNames(),
    ]);

  // The engine has not run for this checkout. Say so rather than render an
  // empty scaffold that reads like an answer.
  if (!indexFile) {
    return (
      <SectionBand tone="surface">
        <h1 className="ds-h1">How busy will Boone be?</h1>
        <p className="mt-2 max-w-2xl ds-body text-muted">
          The Busy-ness Index is not available right now. The engine scores the next two weeks and
          writes them to a file this page reads, and that file is missing, so there is nothing
          honest to show you.
        </p>
      </SectionBand>
    );
  }

  const { issued, index } = indexFile;
  const horizon = index.horizon;
  const weekend = upcomingWeekend(horizon, issued);
  const peak = weekend?.peak ?? horizon[0];
  const ranking = vsTypical(observations, { issued, date: peak.date, score: peak.score });
  const events = eventOverlay(horizon, registry, athletics);
  const confirmed = crossConfirmation(horizon);

  const heat = lodging
    ? heatCalendarDays(lodging.capture.summary.high_share, lodging.captured, CALENDAR_DAYS)
    : [];
  const priced = heat.filter((d) => d.share !== null).length;

  const rates = weekendRateSeries(rateObservations(captures, "boone"), { lead: RATE_LEAD });
  const typicalRate = median(rates.points.map((p) => p.median));

  const band = peak.band;
  const weekdayName = weekdayLong(peak.date);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "How busy will Boone be? The High Country Busy-ness Index",
      "description":
        "A scored forecast of how crowded Boone and the NC High Country will be over the next two weeks, built from hotel pricing, rental booking pace, events, and predicted peak fall color.",
      "url": URL,
      "isAccessibleForFree": true,
      "publisher": { "@type": "Organization", "name": "Dave's Sweater", "url": "https://davessweater.com" },
      "mainEntityOfPage": URL,
      "dateModified": index.computed_at,
    },
    {
      "@context": "https://schema.org",
      "@type": "Dataset",
      "name": "High Country Busy-ness Index",
      "description":
        "A daily 0 to 100 crowding score for the next 14 days in Boone and the NC High Country, with the hotel, short-term-rental, event, fall color, and weekend components that produced it.",
      "url": URL,
      "license": "https://creativecommons.org/licenses/by/4.0/",
      "isAccessibleForFree": true,
      "creator": { "@type": "Organization", "name": "Dave's Sweater", "url": "https://davessweater.com" },
      "temporalCoverage": `${horizon[0].date}/${horizon[horizon.length - 1].date}`,
      "spatialCoverage": { "@type": "Place", "name": "North Carolina High Country" },
      "dateModified": index.computed_at,
      "distribution": {
        "@type": "DataDownload",
        "encodingFormat": "application/json",
        "contentUrl": "https://davessweater.com/api/v1/tourism",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://davessweater.com" },
        { "@type": "ListItem", "position": 2, "name": "Busy-ness Index", "item": URL },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "How busy will Boone be this weekend?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": `${weekdayName}, ${fmtLongDate(peak.date)} scores ${Math.round(peak.score)} out of 100 on our Busy-ness Index, which puts it in the ${BAND_COPY[band].toLowerCase()} band. The drivers are ${peak.drivers.length ? peak.drivers.join(", ") : "nothing on the calendar and nothing in the pricing"}.`,
          },
        },
        {
          "@type": "Question",
          "name": "What is the High Country Busy-ness Index built from?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Five components, summed and clamped to 0 to 100: hotel pricing bands worth up to 40 points, short-term-rental booking pace worth up to 25, the event calendar worth up to 30 net, our own predicted peak fall color worth up to 15, and a flat 5 for a Friday or Saturday.",
          },
        },
        {
          "@type": "Question",
          "name": "Is the Busy-ness Index accurate?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Unproven, and we say so. It is a demand forecast built from what lodging costs and who is booking it, not a count of anybody. We publish the formula so you can judge it, and the plan is to grade it against occupancy-tax receipts and traffic counts the same way we grade the weather.",
          },
        },
      ],
    },
  ];

  return (
    <>
      <JsonLd data={jsonLd} />

      <SectionBand tone="surface">
        <div className="ds-kicker text-orange-600">Busy-ness Index</div>
        <h1 className="mt-1 ds-h1">How busy will Boone be?</h1>
        <p className="mt-3 max-w-2xl ds-body text-muted">
          Nobody counts the people coming up the mountain. But the hotels price the weekend before
          it arrives, the rentals fill on a schedule, the calendar is public, and we already forecast
          the weather and the leaves. Put those together and you get a usable answer, so we did, and
          we are giving it away.
        </p>

        <p className={`mt-6 ds-stat ${BAND_TONE[band]}`}>
          {weekdayName} looks {BAND_COPY[band].toLowerCase()}
        </p>
        <p className="mt-1 ds-caption">
          {fmtLongDate(peak.date)} <span className="mx-1">|</span> {Math.round(peak.score)} of 100
        </p>

        {peak.drivers.length ? (
          <ul className="mt-4 max-w-2xl space-y-1 ds-body text-muted">
            {peak.drivers.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 max-w-2xl ds-body text-muted">
            Nothing on the calendar and nothing unusual in the pricing. Come on up.
          </p>
        )}

        {ranking ? (
          <p className="mt-4 max-w-2xl ds-body text-muted">
            That is busier than {ranking.percentile}% of the {ranking.sampleSize} comparable{" "}
            {ranking.dayClass === "weekend" ? "weekend nights" : "weeknights"} we have measured so
            far, all of them read {ranking.leadDays}{" "}
            {ranking.leadDays === 1 ? "day" : "days"} ahead like this one. A typical one of those
            scored {ranking.median}.
          </p>
        ) : (
          <p className="mt-4 max-w-2xl ds-body text-muted">
            We cannot yet say how that compares to a typical night. Ranking a night means holding
            the day of the week and how far ahead we looked constant, and the record is not deep
            enough to do that honestly for this one.
          </p>
        )}

        {weekend?.friday && weekend.saturday ? (
          <p className="mt-4 max-w-2xl ds-body text-muted">
            The other half of the weekend:{" "}
            {weekend.peak.date === weekend.saturday.date ? "Friday" : "Saturday"} scores{" "}
            {Math.round(
              (weekend.peak.date === weekend.saturday.date ? weekend.friday : weekend.saturday)
                .score,
            )}
            .
          </p>
        ) : null}
      </SectionBand>

      <SectionBand>
        <h2 className="ds-h2">The next two weeks</h2>
        <p className="mt-2 max-w-2xl ds-body text-muted">
          Every date the engine scored, with the reasons it gave. The reasons are printed exactly as
          the engine wrote them, so if a number looks wrong you can see which input to blame.
        </p>
        <BusynessHorizon days={horizon} />
        <p className="mt-4 ds-caption">
          Scored {fmtLongDate(index.computed_at.slice(0, 10))}
          {index.missing_inputs.length ? (
            <>
              {" "}
              <span className="mx-1">|</span> Missing inputs: {index.missing_inputs.join(", ")}
            </>
          ) : null}
        </p>
      </SectionBand>

      {events.length ? (
        <SectionBand tone="surface">
          <h2 className="ds-h2">What is on in the next two weeks</h2>
          <p className="mt-2 max-w-2xl ds-body text-muted">
            The events the score actually counted, from our own registry and the App State athletics
            calendar. An event on this list moved a number above; an event not on it did not, either
            because it falls outside the window or because we have not verified it.
          </p>
          <ul className="mt-4 max-w-2xl space-y-2 ds-body text-muted">
            {events.map((e) => (
              <li key={e.id}>
                <strong className="text-foreground">{e.name}</strong>
                <span className="mx-1">|</span>
                {e.dates.length === 1
                  ? fmtLongDate(e.dates[0])
                  : `${fmtLongDate(e.dates[0])} to ${fmtLongDate(e.dates[e.dates.length - 1])}`}
              </li>
            ))}
          </ul>
        </SectionBand>
      ) : null}

      <SectionBand>
        <h2 className="ds-h2">Thirty days of hotel pricing</h2>
        <p className="mt-2 max-w-2xl ds-body text-muted">
          Hotels decide months ahead which nights they think will be in demand, and they tell you by
          moving the price. This is that decision, one square a night, for every hotel we track
          across Boone and Blowing Rock. It runs further out than the score does, which makes it the
          part of the page worth checking if you are still picking a weekend.
        </p>
        {heat.length ? (
          <>
            <BusynessCalendar days={heat} />
            <p className="mt-4 ds-caption">
              Read {fmtLongDate(lodging!.captured)} <span className="mx-1">|</span> {priced} of{" "}
              {CALENDAR_DAYS} nights priced so far
            </p>
          </>
        ) : (
          <p className="mt-4 max-w-2xl ds-body text-muted">
            No lodging capture is available right now, so there is no calendar to draw.
          </p>
        )}
      </SectionBand>

      {rates.points.length >= 2 ? (
        <SectionBand tone="surface">
          <h2 className="ds-h2">What a Saturday night costs</h2>
          <p className="mt-2 max-w-2xl ds-body text-muted">
            The median cheapest listed rate across the Boone hotels we track, one bar per weekend.
            Every bar is read {RATE_LEAD} days before the night itself, because hotel rates drift as
            a date approaches and lining up whatever reading happened to be newest would turn that
            drift into fake seasonality.
          </p>
          <WeekendRateTrend points={rates.points} typical={typicalRate} />
          {rates.excluded.length ? (
            <p className="mt-4 ds-caption">
              Not shown: {rates.excluded.map(fmtLongDate).join(", ")}. Still too far out to have
              been read at a matching lead time.
            </p>
          ) : null}
        </SectionBand>
      ) : null}

      <SectionBand tone="dark">
        <div className="ds-kicker text-orange-300">Methodology</div>
        <h2 className="mt-1 ds-h2">The whole formula</h2>
        <p className="mt-3 ds-body text-white/70">
          Five components, added up and clamped to a 0 to 100 scale. No weighting is hidden and
          nothing is fit to anything. These are declared priors, which is a polite way of saying we
          picked them and we will be graded on them.
        </p>

        <h3 className="mt-6 ds-h3">Hotel pricing, up to 40 points</h3>
        <p className="mt-2 ds-body text-white/70">
          The share of the hotels on our roster that have priced the night into their own high band,
          scaled to 40. It is the largest component because it is the one signal that is
          forward-looking, specific to a date, and made by somebody with money on the outcome.
        </p>

        <h3 className="mt-6 ds-h3">Rental booking pace, up to 25 points</h3>
        <p className="mt-2 ds-body text-white/70">
          The mean fill rate across the Boone and Blowing Rock short-term-rental markets, each
          capped at fully booked before averaging. Rentals are the dominant lodging segment here,
          which is why they are in at all, and the reading is a booking pace rather than a count of
          beds.
        </p>

        <h3 className="mt-6 ds-h3">Events, up to 30 points net</h3>
        <p className="mt-2 ds-body text-white/70">
          A major event is worth 20, a moderate one 10, a minor one 4, and the positive side is
          capped at 30 so a busy calendar cannot run away with the score. Long-running seasons count
          at half weight because a season is a background, not a day. Events that push people out of
          town rather than in, and there are a few, subtract instead of adding.
        </p>

        <h3 className="mt-6 ds-h3">Peak fall color, up to 15 points</h3>
        <p className="mt-2 ds-body text-white/70">
          The share of the towns we track whose predicted peak color window covers the night, from
          our own{" "}
          <Link href="/leaf" className="text-white underline underline-offset-2">
            leaf model
          </Link>
          , scaled to 15. It replaced a flat calendar guess that called all of October equally busy,
          which October is not. The cap is deliberate. Leaf season is the year&apos;s biggest tourism
          swing, but it is a prediction, and it should not be able to call a Tuesday slammed on its
          own.
        </p>

        <h3 className="mt-6 ds-h3">Weekend, 5 points</h3>
        <p className="mt-2 ds-body text-white/70">
          A flat 5 on Fridays and Saturdays. It is small on purpose. If a weekend is going to be
          busy, the lodging signals should already know.
        </p>

        <h3 className="mt-6 ds-h3">The bands</h3>
        <p className="mt-2 ds-body text-white/70">
          Under 35 is calm, 35 to 54 typical, 55 to 74 busy, 75 and over slammed. Those cutoffs are
          ours, they were set before we had a season of scores to fit them to, and they will move
          only if grading says they should.
        </p>

        <h3 className="mt-6 ds-h3">And the comparison</h3>
        <p className="mt-2 ds-body text-white/70">
          Where the page says a night beats some percentage of comparable nights, the comparison
          holds two things constant: the day of the week, because a Saturday is not a Tuesday, and
          how far ahead we looked, because rental fill climbs continuously as a date approaches and
          a night read three days out would beat the same night read two weeks out for no real
          reason. A night is never compared against itself. If fewer than a dozen comparable nights
          exist, we print no percentage at all.
        </p>
      </SectionBand>

      <SectionBand>
        <h2 className="ds-h2">What this index cannot do</h2>
        <p className="mt-2 max-w-2xl ds-body text-muted">
          {archive ? (
            <>
              The record behind every comparison on this page is {archive.days} mornings, running
              from {fmtLongDate(archive.from)} to {fmtLongDate(archive.to)}.
            </>
          ) : (
            <>The record behind every comparison on this page is short.</>
          )}{" "}
          That is enough to say how a night stacks up against other late-summer nights and nowhere
          near enough to say what a normal October looks like. The first real leaf season this index
          sees will be the one that teaches it, not the one it predicts well.
        </p>
        <ul className="mt-4 max-w-2xl space-y-2 ds-body text-muted">
          <li>
            <strong className="text-foreground">Hotels are the minority here.</strong> Short-term
            rentals are the dominant lodging segment in Boone, and the hotel roster is a couple of
            dozen properties. The rental component covers the gap partially, not fully.
          </li>
          <li>
            <strong className="text-foreground">A listed rate is a floor, not a takings.</strong>{" "}
            The number we read is the cheapest nightly rate showing on a booking site, which is a
            bookability signal. It is not average daily rate and it is not revenue.
          </li>
          <li>
            <strong className="text-foreground">Booking pace is biased by lead time.</strong> A
            night two days out is naturally fuller than the same night two weeks out, and the engine
            does not correct for it. Inventing a correction curve without the data to fit one would
            be worse than saying this plainly, so we say it plainly, and every comparison above
            controls for it instead.
          </li>
          <li>
            <strong className="text-foreground">Nothing here counts a person.</strong> This is a
            demand forecast assembled from what lodging costs and who is booking it. It is not a
            traffic count, a headcount, or a till.
          </li>
          <li>
            <strong className="text-foreground">The bands are absolute for now.</strong> A score of
            60 means 60 on this scale. It does not yet mean busier than a typical mid-October
            Saturday, because we have not lived through one with the engine running.
          </li>
        </ul>
      </SectionBand>

      <SectionBand tone="surface">
        <div className="ds-kicker text-orange-600">Cross-confirmation</div>
        <h2 className="mt-1 ds-h2">When two signals agree</h2>
        {confirmed.length ? (
          <>
            <p className="mt-2 max-w-2xl ds-body text-muted">
              Our leaf model knows nothing about hotel pricing and the hotels know nothing about our
              leaf model. On the nights below they agree anyway, which is a stronger claim than
              either one makes alone.
            </p>
            <ul className="mt-4 max-w-2xl space-y-2 ds-body text-muted">
              {confirmed.map((c) => (
                <li key={c.date}>
                  <strong className="text-foreground">{fmtLongDate(c.date)}</strong>
                  <span className="mx-1">|</span>
                  {Math.round(c.leafShare * 100)}% of tracked towns at predicted peak color, and{" "}
                  {Math.round(c.hotelShare * 100)}% of hotels pricing the night high
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-2 max-w-2xl ds-body text-muted">
            The trick this index was built for is two independent signals landing on the same
            night, our leaf model calling peak color while the hotels have separately priced that
            night high. Neither knows about the other, so agreement means something. It is not in play
            right now, because no date in the current window is inside a predicted peak window. When
            October arrives, agreements and disagreements both get printed here.
          </p>
        )}
      </SectionBand>

      <SectionBand>
        <h2 className="ds-h2">Take the data</h2>
        <p className="mt-2 max-w-2xl ds-body text-muted">
          The whole index is free, licensed CC BY 4.0, and available as JSON at{" "}
          <Link href="/api/v1/tourism" className="text-foreground underline underline-offset-2">
            /api/v1/tourism
          </Link>{" "}
          or as a feed at{" "}
          <Link
            href="/feed/high-country/busyness.xml"
            className="text-foreground underline underline-offset-2"
          >
            /feed/high-country/busyness.xml
          </Link>
          . If you run something in this town that gets busy, take it and use it.{" "}
          <Link href="/api" className="text-foreground underline underline-offset-2">
            The rest of the free data is here
          </Link>
          , and{" "}
          <Link href="/roads" className="text-foreground underline underline-offset-2">
            the road forecast
          </Link>{" "}
          answers the other half of the same question.
        </p>
      </SectionBand>
    </>
  );
}
