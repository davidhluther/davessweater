import Link from "next/link";
import SectionBand from "@/components/SectionBand";
import JsonLd from "@/components/JsonLd";
import CoverageMatrix from "@/components/CoverageMatrix";
import { getScores } from "@/lib/data";

export const metadata = {
  title: "How we score weather forecast accuracy",
  description:
    "How Dave's Sweater grades every Boone forecast against what actually happened: the 100-point model, coverage-fair scoring, and public data you can recompute.",
  alternates: { canonical: "/methodology" },
  openGraph: {
    title: "How Dave's Sweater scores forecast accuracy",
    description:
      "The 100-point model, coverage-fair scoring, and where the “actual” weather comes from — all public and reproducible.",
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
      "The 100-point model, coverage-fair scoring, the NWS qualitative-wind mapping, and where the actual weather comes from. All public and reproducible.",
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
          The whole point of this site is that the claims are <em>tracked data</em>, not assertion. So here is
          the entire method, in the open: how each forecast earns its points, how we keep the comparison fair,
          and where the &ldquo;actual&rdquo; weather comes from.
        </p>
      </SectionBand>

      <SectionBand tone="light">
        <h2 className="font-display text-xl font-bold">The 100-point model</h2>
        <p className="mb-3 mt-1 text-sm text-muted">
          Each day, every forecast is compared to the actual recorded conditions across five fields. Closer =
          more points. The five fields total 100 possible points:
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
                <td className="py-2">within 2&deg;F of actual; then &minus;3 pts per &deg;F beyond.</td>
              </tr>
              <tr className="border-b border-border/60">
                <td className="py-2 pr-3 font-medium">Low temp</td>
                <td className="py-2 pr-3 tabular-nums">30</td>
                <td className="py-2">within 2&deg;F of actual; then &minus;3 pts per &deg;F beyond.</td>
              </tr>
              <tr className="border-b border-border/60">
                <td className="py-2 pr-3 font-medium">Wind</td>
                <td className="py-2 pr-3 tabular-nums">20</td>
                <td className="py-2">
                  within 3 mph of actual; then &minus;2 pts per mph beyond. A forecast given as a{" "}
                  <em>range</em> is scored at its midpoint, plus a vagueness tax of half the range&rsquo;s width
                  added to the error &mdash; so &ldquo;5&ndash;15 mph&rdquo; scores lower than a precise
                  &ldquo;10 mph&rdquo; for the same midpoint. A single number has zero width and pays no tax.
                </td>
              </tr>
              <tr className="border-b border-border/60">
                <td className="py-2 pr-3 font-medium">Precip type</td>
                <td className="py-2 pr-3 tabular-nums">10</td>
                <td className="py-2">
                  exact match (rain / snow / mixed / none) = 10; right that <em>something</em> falls but wrong
                  form (e.g. called rain, got snow) = 4; otherwise 0.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-3 font-medium">Precip amount</td>
                <td className="py-2 pr-3 tabular-nums">10</td>
                <td className="py-2">
                  rain within 0.1&Prime; (then &minus;2 pts per extra 0.1&Prime;); snow is scored in depth with a
                  coarser tolerance of 1&Prime; or 20% of the actual, whichever is larger, because snow totals
                  are inherently noisier.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionBand>

      <SectionBand tone="surface">
        <h2 className="font-display text-xl font-bold">Saying &ldquo;no rain&rdquo; is a forecast too</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Every forecast is scored out of a fixed 100. The one wrinkle is the rain total. When a service says it{" "}
          <em>won&rsquo;t</em> rain, that&rsquo;s a zero-inch prediction &mdash; and on a dry day it earns those
          points like any other right call. When a service says it <em>will</em> rain but won&rsquo;t say how
          much, it leaves the amount blank and gets no credit for it.
        </p>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          That matters for{" "}
          <Link href="/right-wrong-ray" className="text-teal underline underline-offset-2">Ray&rsquo;s Weather</Link>,
          who never publishes a numeric rain total: he earns the amount points on the days he forecasts dry, and
          forfeits them on the days he forecasts rain. What he can&rsquo;t do is come out ahead of a more accurate
          forecast just by staying quiet on the hard number &mdash; leaving a field blank is never worth more than
          answering it.
        </p>
      </SectionBand>

      <SectionBand tone="light">
        <h2 className="font-display text-xl font-bold">When the forecast is in words</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Ray&rsquo;s often describes wind in words rather than numbers. We map those to the National Weather
          Service&rsquo;s qualitative scale, then score the result as a range like any other:
        </p>
        <ul className="mt-2 grid max-w-md grid-cols-2 gap-x-6 gap-y-1 text-sm text-muted">
          <li>calm &mdash; 0&ndash;1 mph</li>
          <li>light &mdash; 1&ndash;7 mph</li>
          <li>breezy &mdash; 12&ndash;20 mph</li>
          <li>windy / gusty &mdash; 18&ndash;30 mph</li>
        </ul>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          We only read a word as a wind descriptor when it actually sits next to &ldquo;wind&rdquo; (so
          &ldquo;light rain&rdquo; isn&rsquo;t mistaken for light wind), and we strip any &ldquo;gusting to
          N&rdquo; clause so only sustained wind is scored.
        </p>
      </SectionBand>

      <SectionBand tone="surface">
        <h2 className="font-display text-xl font-bold">Grades</h2>
        <p className="mt-1 text-sm text-muted">The day&rsquo;s score becomes a verdict:</p>
        <ul className="mt-2 space-y-1 text-sm text-muted">
          <li><strong className="text-foreground">90&ndash;100</strong> &mdash; Right (5 rays)</li>
          <li><strong className="text-foreground">75&ndash;89</strong> &mdash; Right (4 rays)</li>
          <li><strong className="text-foreground">60&ndash;74</strong> &mdash; Meh (3 rays)</li>
          <li><strong className="text-foreground">under 60</strong> &mdash; Wrong (1&ndash;2 rays)</li>
        </ul>
      </SectionBand>

      <SectionBand tone="light">
        <h2 className="font-display text-xl font-bold">What counts as &ldquo;actual&rdquo;</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          The conditions we grade against come from the{" "}
          <a href="https://open-meteo.com/en/docs/historical-weather-api" className="text-teal underline underline-offset-2"
             target="_blank" rel="noopener noreferrer">Open-Meteo historical archive</a>{" "}
          &mdash; a reanalysis of observed weather for Boone. We say this plainly because it cuts both ways: one
          of the forecasters we track, Open-Meteo, is therefore being graded partly against its own provider&rsquo;s
          archive. We disclose it rather than bury it, the same numbers are applied to every source, and the
          comparison that carries the whole thesis &mdash; free vs. Ray&rsquo;s &mdash; doesn&rsquo;t depend on
          that one source. To remove the circularity entirely we&rsquo;re standing up an independent ground-truth
          weather station in Boone; once it&rsquo;s live, its readings become the &ldquo;actual.&rdquo;
        </p>
      </SectionBand>

      <SectionBand tone="surface">
        <h2 className="font-display text-xl font-bold">What each service reports</h2>
        <p className="mb-4 mt-1 max-w-2xl text-sm text-muted">
          Not every forecaster publishes every field. Here&apos;s what each one gives us to score &mdash; a blank
          isn&apos;t a wrong answer, it&apos;s a question they didn&apos;t answer.
        </p>
        <CoverageMatrix scores={scores} />
      </SectionBand>
    </>
  );
}
