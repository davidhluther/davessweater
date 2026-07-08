import Link from "next/link";
import { cn } from "@/lib/utils";
import { copy } from "@/content/copy";
import { getForecast5Day, stripDays } from "@/lib/forecast5";
import { getLeadtimeScores, compositeMemberMaePair } from "@/lib/leadtime";

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
  // Tooltip count = forecasters contributing to the leading day's consensus,
  // the same derivation (compositeForecast().count) behind the Dave's Sweater
  // Index footnote just above the strip.
  const tooltip = copy.fiveDay.tooltip(days[0].count);

  return (
    <>
      <div className="my-6 border-t border-border" />
      <div className="text-center">
        <div className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted">
          The 5-day <span className="text-muted/60">|</span> {f5.location}
          <span
            title={tooltip}
            aria-label={tooltip}
            className="ml-1.5 inline-flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full border border-border align-[-2px] text-[0.55rem] font-bold normal-case leading-none text-muted"
          >
            i
          </span>
        </div>

        <div
          className={cn(
            "mt-3 flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 sm:grid sm:overflow-visible sm:pb-0",
            GRID_COLS[days.length] ?? "sm:grid-cols-6",
          )}
        >
          {days.map((d) => (
            <div
              key={d.date}
              className="min-w-[6.5rem] shrink-0 snap-start rounded-lg border border-border bg-background px-1.5 py-2.5 text-center sm:min-w-0 sm:shrink"
            >
              <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted">{d.weekday}</div>
              <div className="text-[0.6rem] text-muted">{d.dayLabel}</div>
              <div className="mt-1 text-[0.7rem] font-medium text-foreground">{d.precipLabel}</div>
              <div className="mt-0.5 font-display text-lg font-bold text-teal">
                {d.high}° <span className="align-middle font-sans text-xs font-normal text-muted/60">|</span>{" "}
                <span className="align-middle font-sans text-xs font-normal text-muted">{d.low}°</span>
              </div>
              {d.precip !== "none" && d.precipProb != null ? (
                <div className="mt-0.5 text-[0.65rem] text-muted">
                  {CHANCE_WORD[d.precip] ?? d.precipLabel} · {d.precipProb}%
                </div>
              ) : null}
              <div className="mt-1.5 flex justify-center gap-0.5" role="img" aria-label={`${d.sweaters} of 5 sweaters`}>
                {sweaterIcons(d.sweaters)}
              </div>
            </div>
          ))}
        </div>

        {maePair ? (
          <p className="mt-3 text-xs text-muted">
            Measured: the forecasts behind this consensus have missed the next-day high by ±{maePair.a.mae}°F on
            average; day 5 runs ±{maePair.b.mae}°F. <span className="text-muted/60">|</span>{" "}
            <Link href="/methodology" className="text-teal underline underline-offset-2">How we grade &rarr;</Link>
          </p>
        ) : null}
        <p className="mt-1.5 text-xs">
          <Link href="/right-wrong-ray" className="text-teal underline underline-offset-2">See the scoreboard &rarr;</Link>
        </p>
      </div>
    </>
  );
}
