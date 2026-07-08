import Link from "next/link";
import SectionBand from "@/components/SectionBand";
import JsonLd from "@/components/JsonLd";
import CoverageMatrix from "@/components/CoverageMatrix";
import { getScores } from "@/lib/data";

export const metadata = {
  title: "How we score weather forecast accuracy",
  description:
    "How Dave's Sweater grades every Boone forecast against what actually happened: the 100-point model, how unpublished fields are handled, and where the actual weather comes from.",
  alternates: { canonical: "/methodology" },
  openGraph: {
    title: "How Dave's Sweater scores forecast accuracy",
    description:
      "The 100-point model, how we handle fields a forecaster leaves blank, and where the actual weather comes from.",
    url: "https://davessweater.com/methodology",
    type: "article",
  },
};

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "headline": "How Dave's Sweater scores weather forecast accuracy",
    "description":
      "The 100-point model, the NWS qualitative-wind mapping, and where the actual weather comes from.",
    "about": "Weather forecast accuracy scoring methodology",
    "isAccessibleForFree": true,
    "author": { "@type": "Organization", "name": "Dave's Sweater" },
    "publisher": { "@type": "Organization", "name": "Dave's Sweater", "url": "https://davessweater.com" },
    "mainEntityOfPage": "https://davessweater.com/methodology",
    "url": "https://davessweater.com/methodology",
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://davessweater.com" },
      { "@type": "ListItem", "position": 2, "name": "Methodology", "item": "https://davessweater.com/methodology" },
    ],
  },
];

export default async function Page() {
  const scores = await getScores();
  return (
    <>
      <JsonLd data={jsonLd} />
      <SectionBand tone="surface">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">How we score it</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Every score on this site is tracked data, not opinion. One rubric runs against every forecaster, every
          day. Here is what it measures, and where the actual weather comes from.
        </p>
      </SectionBand>

      <SectionBand tone="light">
        <h2 className="font-display text-xl font-bold">The 100-point model</h2>
        <p className="mb-3 mt-1 text-sm text-muted">
          Each day we compare a forecast to the actual recorded conditions across five fields. Closer to the
          truth earns more points, out of 100:
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="py-2 pr-3">Field</th>
                <th className="py-2 pr-3">Max</th>
                <th className="py-2">Full credit when&hellip;</th>
              </tr>
            </thead>
            <tbody className="align-top">
              <tr className="border-b border-border/60">
                <td className="py-2 pr-3 font-medium">High temp</td>
                <td className="py-2 pr-3 tabular-nums">30</td>
                <td className="py-2">within 2&deg;F of actual, then &minus;3 pts per &deg;F beyond.</td>
              </tr>
              <tr className="border-b border-border/60">
                <td className="py-2 pr-3 font-medium">Low temp</td>
                <td className="py-2 pr-3 tabular-nums">30</td>
                <td className="py-2">within 2&deg;F of actual, then &minus;3 pts per &deg;F beyond.</td>
              </tr>
              <tr className="border-b border-border/60">
                <td className="py-2 pr-3 font-medium">Wind</td>
                <td className="py-2 pr-3 tabular-nums">20</td>
                <td className="py-2">
                  within 3 mph of actual, then &minus;2 pts per mph beyond. A forecast given as a{" "}
                  <em>range</em> is scored at its midpoint, then taxed by half the range width for vagueness. A
                  5&ndash;15 mph range scores lower than a precise 10 mph for the same midpoint. A single number
                  has zero width and pays no tax.
                </td>
              </tr>
              <tr className="border-b border-border/60">
                <td className="py-2 pr-3 font-medium">Precip type</td>
                <td className="py-2 pr-3 tabular-nums">10</td>
                <td className="py-2">
                  exact match (rain, snow, mixed, or none) = 10. Right that <em>something</em> falls but wrong
                  form, say rain when it snowed, = 4. Otherwise 0.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-3 font-medium">Precip amount</td>
                <td className="py-2 pr-3 tabular-nums">10</td>
                <td className="py-2">
                  rain within 0.1&Prime;, then &minus;2 pts per extra 0.1&Prime;. Snow uses a coarser tolerance of
                  1&Prime; or 20% of the actual, whichever is larger, because snow totals are noisier.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionBand>

      <SectionBand tone="surface">
        <h2 className="font-display text-xl font-bold">Saying &quot;no rain&quot; is a forecast too</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Every forecast is scored out of a fixed 100. The one wrinkle is the rain total. A forecast of no rain
          is a zero-inch prediction, so on a dry day it earns those points like any other right call. A forecast
          of rain with no stated total leaves the amount blank and earns nothing for it.
        </p>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          That matters for{" "}
          <Link href="/right-wrong-ray" className="text-teal underline underline-offset-2">Ray&apos;s Weather</Link>,
          who never publishes a numeric rain total. He earns the amount points on the days he forecasts dry, and
          forfeits them on the days he forecasts rain. Staying quiet on the hard number cannot beat answering it.
          A blank is never worth more than a real forecast.
        </p>
      </SectionBand>

      <SectionBand tone="light">
        <h2 className="font-display text-xl font-bold">When the forecast is in words</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Ray&apos;s often describes wind in words instead of numbers. We map those to the National Weather
          Service scale, then score the result as a range like any other:
        </p>
        <ul className="mt-2 grid max-w-md grid-cols-2 gap-x-6 gap-y-1 text-sm text-muted">
          <li>calm: 0&ndash;1 mph</li>
          <li>light: 1&ndash;7 mph</li>
          <li>breezy: 12&ndash;20 mph</li>
          <li>windy or gusty: 18&ndash;30 mph</li>
        </ul>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          A word only counts as a wind descriptor when it sits next to the word &quot;wind,&quot; so a phrase
          like &quot;light rain&quot; is not read as light wind. We also strip any &quot;gusting to N&quot;
          clause, so only sustained wind is scored.
        </p>
      </SectionBand>

      <SectionBand tone="light">
        <h2 className="font-display text-xl font-bold">Reading the overnight low</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Most services hand us a finished daily low that already covers the whole day, including the pre-dawn
          hours. Two of them, Met.no and OpenWeather, don&apos;t. We rebuild their daily low ourselves from an
          hour-by-hour feed, and by the time we capture at midday that feed no longer reaches back to the
          overnight low.
        </p>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          So for those two we read the low from the forecast they published the morning before, when the full day
          was still ahead. That is a longer lead time than the same-day number every other source gets, so if
          anything it is a slightly harder test. Sources that give us a full-day low directly are scored on it
          as is.
        </p>
      </SectionBand>

      <SectionBand tone="surface">
        <h2 className="font-display text-xl font-bold">Grades</h2>
        <p className="mt-1 text-sm text-muted">The day&apos;s score becomes a verdict:</p>
        <ul className="mt-2 space-y-1 text-sm text-muted">
          <li><strong className="text-foreground">90&ndash;100</strong>: Right (5 rays)</li>
          <li><strong className="text-foreground">75&ndash;89</strong>: Right (4 rays)</li>
          <li><strong className="text-foreground">60&ndash;74</strong>: Meh (3 rays)</li>
          <li><strong className="text-foreground">under 60</strong>: Wrong (1&ndash;2 rays)</li>
        </ul>
      </SectionBand>

      <SectionBand tone="light">
        <h2 className="font-display text-xl font-bold">What counts as &quot;actual&quot;</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          The conditions we grade against come from the{" "}
          <a href="https://open-meteo.com/en/docs/historical-weather-api" className="text-teal underline underline-offset-2"
             target="_blank" rel="noopener noreferrer">Open-Meteo historical archive</a>, a reanalysis of observed
          weather for Boone. We say this plainly because it cuts both ways. One forecaster we track, Open-Meteo,
          is graded partly against its own provider&apos;s archive. The same numbers apply to every source, and
          the free-versus-Ray&apos;s comparison that carries the thesis does not lean on that one source. To close
          the gap for good, we are standing up an independent weather station in Boone. Once it is live, its
          readings become the actual.
        </p>
      </SectionBand>

      <SectionBand tone="surface">
        <h2 className="font-display text-xl font-bold">What each service reports</h2>
        <p className="mb-4 mt-1 max-w-2xl text-sm text-muted">
          Not every forecaster publishes every field. Here is what each one gives us to score. A blank means the
          question went unanswered, not that they got it wrong.
        </p>
        <CoverageMatrix scores={scores} />
        <p className="mt-6 max-w-2xl text-sm text-muted">
          To see the model applied, read{" "}
          <Link href="/resources/articles/is-rays-weather-accurate" className="text-teal underline underline-offset-2">
            the 118-day review of Ray&apos;s Weather
          </Link>
          ,{" "}
          <Link href="/resources/articles/rays-weather-report-card-june-2026" className="text-teal underline underline-offset-2">
            the June 2026 report card
          </Link>
          , or{" "}
          <Link href="/resources/articles/how-accurate-is-a-10-day-forecast" className="text-teal underline underline-offset-2">
            what a 10-day forecast is actually good for
          </Link>
          .
        </p>
      </SectionBand>
    </>
  );
}
