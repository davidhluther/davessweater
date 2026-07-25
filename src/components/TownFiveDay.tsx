import { cn } from "@/lib/utils";
import type { StripDay } from "@/lib/forecast5";

// Presentational week-ahead strip for a town page: the same free-forecaster
// consensus + sweater verdict as the homepage FiveDayStrip, but fed StripDay[]
// as a prop (the homepage component self-fetches Boone's precomputed artifact
// and carries Boone-only lead-time stats, so towns get this leaner twin).

const CHANCE_WORD: Record<string, string> = { rain: "Rain", snow: "Snow", mixed: "Wintry mix" };

const GRID_COLS: Record<number, string> = {
  2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4",
  5: "sm:grid-cols-5", 6: "sm:grid-cols-6",
};

function sweaterIcons(score: number) {
  return Array.from({ length: 5 }, (_, i) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img key={i} src="/assets/sweateremoji.webp" alt=""
      className={i < score ? "inline h-4 w-4" : "inline h-4 w-4 opacity-25 grayscale"} />
  ));
}

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

export default function TownFiveDay({ days }: { days: StripDay[] }) {
  if (days.length < 2) return null;
  const showConfidence = days.some((d) => d.confidence !== "low");
  return (
    <div className={cn("mt-3 flex flex-col gap-1.5 sm:grid sm:gap-2", GRID_COLS[days.length] ?? "sm:grid-cols-5")}>
      {days.map((d) => (
        <div
          key={d.date}
          className="rounded-lg border border-border bg-background px-3 py-2 text-left sm:px-1.5 sm:py-2.5 sm:text-center"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:flex-col sm:flex-nowrap sm:items-stretch sm:gap-0">
            <div className="w-11 shrink-0 sm:w-auto">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted sm:text-[0.65rem]">{d.weekday}</div>
              <div className="text-[0.6rem] text-muted">{d.dayLabel}</div>
            </div>
            <div className="min-w-0 flex-1 sm:mt-1 sm:flex-none">
              <div className="text-sm font-medium text-foreground sm:text-[0.7rem]">{d.summary}</div>
              {d.wind ? <div className="text-[0.6rem] text-muted">Wind: {d.wind}</div> : null}
            </div>
            <div className="shrink-0 text-right sm:mt-0.5 sm:text-center">
              <div className="font-display text-lg font-bold leading-tight text-teal">
                {d.high}° <span className="align-middle font-sans text-xs font-normal text-muted">{d.low}°</span>
              </div>
              {d.precip !== "none" && d.precipProb != null ? (
                <div className="text-[0.6rem] text-muted">
                  {d.sky === "storm" ? "Storm" : CHANCE_WORD[d.precip] ?? "Precip"}: {d.precipProb}%
                </div>
              ) : null}
            </div>
            <div className="flex w-full items-center gap-3 sm:mt-1.5 sm:w-auto sm:flex-col sm:items-center sm:gap-1">
              <div className="flex shrink-0 gap-0.5" role="img" aria-label={`${d.sweaters} of 5 sweaters`}>
                {sweaterIcons(d.sweaters)}
              </div>
              {showConfidence ? <div className="flex shrink-0">{confidenceMeter(d.confidence)}</div> : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
