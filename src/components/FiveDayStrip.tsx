import Link from "next/link";
import { cn } from "@/lib/utils";
import { getForecast5Day, stripDays } from "@/lib/forecast5";
import { getLeadtimeScores, compositeMemberMaePair } from "@/lib/leadtime";
import RainTimingBar from "@/components/RainTimingBar";

// The consumer half of the Today module: the week ahead for a person who just
// wants Friday's forecast. It states ONE forecast per day — the same
// free-forecaster consensus as the Dave's Sweater Index — with the site's
// sweater verdict. No source names, no scores, no Ray: the receipts live on
// the scoreboard, one quiet link away. Trust info rides in the header tooltip
// and one measured footnote, both server-rendered — no client JS.

const CHANCE_WORD: Record<string, string> = { rain: "Rain", snow: "Snow", mixed: "Wintry mix" };

// Tailwind needs literal class names, so the even-grid column count (2–6 days
// depending on how many days have a consensus) maps through full strings.
const GRID_COLS: Record<number, string> = {
  2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4",
  5: "sm:grid-cols-5", 6: "sm:grid-cols-6",
};

// Same glyph + dimming treatment as the Sweater Weather Index above the strip
// (LiveConditions), sized for a day card.
function sweaterIcons(score: number) {
  return Array.from({ length: 5 }, (_, i) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img key={i} src="/assets/sweateremoji.webp" alt=""
      className={i < score ? "inline h-4 w-4" : "inline h-4 w-4 opacity-25 grayscale"} />
  ));
}

// Source-agreement meter: confidence = how tightly the contributing sources'
// highs cluster that day (spread ≤3°F → high, ≤6°F → medium, else low).
// 3 segments, fill 3/2/1 for high/medium/low; filled = teal, empty = border.
const CONF_FILL: Record<string, number> = { high: 3, medium: 2, low: 1 };
function confidenceMeter(confidence: "high" | "medium" | "low") {
  const filled = CONF_FILL[confidence];
  return (
    <div className="flex items-center gap-1" role="img" aria-label={`agreement: ${confidence}`}>
      <div className="flex gap-0.5">
        {Array.from({ length: 3 }, (_, i) => (
          <span key={i} className={cn("h-1 w-2 rounded-[1px]", i < filled ? "bg-teal" : "bg-border")} />
        ))}
      </div>
      <span className="text-[0.55rem] uppercase tracking-wide text-muted/70">agreement</span>
    </div>
  );
}

export default async function FiveDayStrip() {
  const [f5, scores] = await Promise.all([getForecast5Day(), getLeadtimeScores()]);
  const days = stripDays(f5);
  // Fewer than 2 consensus days is not a strip — render nothing (including no
  // divider) rather than a broken half-strip.
  if (!f5 || days.length < 2) return null;
  // Day-1 vs day-5 miss over the SAME member set (sources scored at both
  // leads), so the two numbers are comparable — not an artifact of short-
  // horizon sources dropping out of one side.
  const maePair = scores ? compositeMemberMaePair(scores, 1, 5) : null;
  // The agreement meter only earns its space when it actually differentiates
  // the days. A week where the sources disagree wide on every day (all "low")
  // is a flat column of one-bar meters that says nothing — drop it entirely
  // rather than imply five separately-uncertain days.
  const showConfidence = days.some((d) => d.confidence !== "low");
  const anyHourly = days.some((d) => d.hourly?.length);
  return (
    <div className="text-center">
        <h2 className="font-display text-lg font-bold sm:text-xl">
          The 5-day <span className="font-normal text-muted/50">|</span> {f5.location}
        </h2>

        {/* Mobile: a vertical list of day rows — every day visible, no swipe.
            sm+: an even grid of cards, one column per day. */}
        <div className={cn("mt-3 flex flex-col gap-1.5 sm:grid sm:gap-2", GRID_COLS[days.length] ?? "sm:grid-cols-5")}>
          {days.map((d) => (
            <div
              key={d.date}
              className="rounded-lg border border-border bg-background px-3 py-2 text-left sm:px-1.5 sm:py-2.5 sm:text-center"
            >
              <div className="flex items-center gap-3 sm:flex-col sm:items-stretch sm:gap-0">
                <div className="w-11 shrink-0 sm:w-auto">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted sm:text-[0.65rem]">{d.weekday}</div>
                  <div className="text-[0.6rem] text-muted">{d.dayLabel}</div>
                </div>
                <div className="flex-1 sm:mt-1 sm:flex-none">
                  <div className="text-sm font-medium text-foreground sm:text-[0.7rem]">{d.summary}</div>
                  {d.wind ? (
                    <div className="text-[0.6rem] text-muted">{d.wind}</div>
                  ) : null}
                </div>
                <div className="shrink-0 text-right sm:mt-0.5 sm:text-center">
                  <div className="font-display text-lg font-bold leading-tight text-teal">
                    {d.high}° <span className="align-middle font-sans text-xs font-normal text-muted">{d.low}°</span>
                  </div>
                  {d.precip !== "none" && d.precipProb != null ? (
                    <div className="text-[0.6rem] text-muted">
                      <span className="hidden sm:inline">{CHANCE_WORD[d.precip] ?? d.precipLabel} · </span>{d.precipProb}%
                    </div>
                  ) : null}
                </div>
                <div className="flex shrink-0 justify-end gap-0.5 sm:mt-1.5 sm:justify-center" role="img" aria-label={`${d.sweaters} of 5 sweaters`}>
                  {sweaterIcons(d.sweaters)}
                </div>
                {showConfidence ? (
                  <div className="flex shrink-0 justify-end sm:mt-1.5 sm:justify-center">
                    {confidenceMeter(d.confidence)}
                  </div>
                ) : null}
              </div>
              {/* When will it rain — Open-Meteo hourly, gated to consensus-wet days
                  in stripDays so a dry card never shows a bar. */}
              {d.hourly?.length ? (
                <div className="mt-2 sm:mt-2.5">
                  <RainTimingBar hours={d.hourly} />
                </div>
              ) : null}
            </div>
          ))}
        </div>

        {anyHourly ? (
          <p className="mt-2 text-[0.65rem] text-muted/80">
            Bars show the hourly chance of rain, 6a–10p (Open-Meteo). Taller, solid bars = heavier odds.
          </p>
        ) : null}

        {maePair ? (
          <p className="mt-3 text-xs text-muted">
            Measured against actuals, the forecasts behind this consensus have missed the next-day high by ±{maePair.a.mae}°F on
            average; day 5 runs ±{maePair.b.mae}°F. <span className="text-muted/60">|</span>{" "}
            <Link href="/methodology" className="text-teal underline underline-offset-2">How we grade</Link>
          </p>
        ) : null}
        <p className="mt-1.5 text-xs">
          <Link href="/right-wrong-ray" className="text-teal underline underline-offset-2">See the scoreboard</Link>
        </p>
    </div>
  );
}
