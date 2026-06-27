import Link from "next/link";
import SectionBand from "@/components/SectionBand";

export const metadata = {
  title: "Methodology",
  description:
    "Exactly how Dave's Sweater scores every Boone forecast against what actually happened — the 100-point model, coverage normalization, and where the 'actual' numbers come from. All public and reproducible.",
};

const REPO = "https://github.com/davidhluther/davessweater";

export default function Page() {
  return (
    <>
      <SectionBand tone="surface">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">How we score it</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          The whole point of this site is that the claims are <em>tracked data</em>, not assertion. So here is
          the entire method, in the open: how each forecast earns its points, how we keep the comparison fair,
          and where the &ldquo;actual&rdquo; weather comes from. Every input and the scoring code are public, so
          you can recompute any number yourself.
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
        <h2 className="font-display text-xl font-bold">Scored on what you actually forecast</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Not every service publishes every field. Rather than punish a forecaster for a number it never gave,
          we score each source out of the points it was <em>eligible</em> for:
        </p>
        <p className="my-3 rounded-lg border border-border bg-background px-4 py-3 text-center font-display text-base font-semibold">
          score = points earned &divide; points available &times; 100
        </p>
        <p className="max-w-2xl text-sm text-muted">
          A field a source never publishes drops out of its denominator instead of counting as a zero. The
          clearest case: Ray&rsquo;s Weather never gives a numeric rain total, so its 10 precip-amount points
          simply aren&rsquo;t in play &mdash; it&rsquo;s graded out of 90, not docked 10 for a question it was
          never asked. You can see this on every breakdown row on the{" "}
          <Link href="/right-wrong-ray" className="text-teal underline underline-offset-2">scoreboard</Link>{" "}
          (&ldquo;Total: 80.7 of 90 available &rarr; 89.7&rdquo;).
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
        <h2 className="font-display text-xl font-bold">Check our work</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          None of this is hidden. Every forecast we capture, the daily actuals, and each scored daily comparison
          are committed to the public repository, and the scoring engine is one readable file. Pull it and
          recompute any number on the board yourself.
        </p>
        <ul className="mt-2 space-y-1 text-sm">
          <li>
            <a href={`${REPO}/blob/main/scripts/scoring.py`} className="text-teal underline underline-offset-2"
               target="_blank" rel="noopener noreferrer">scripts/scoring.py</a>{" "}
            <span className="text-muted">&mdash; the exact scoring engine</span>
          </li>
          <li>
            <a href={`${REPO}/tree/main/data`} className="text-teal underline underline-offset-2"
               target="_blank" rel="noopener noreferrer">data/</a>{" "}
            <span className="text-muted">&mdash; every prediction, actual, and scored comparison</span>
          </li>
        </ul>
        <p className="mt-4 text-xs italic text-muted">
          Not affiliated with, endorsed by, or on speaking terms with Ray&rsquo;s Weather.
        </p>
      </SectionBand>
    </>
  );
}
