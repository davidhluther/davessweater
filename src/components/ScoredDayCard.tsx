import { cn } from "@/lib/utils";
import { barColor, predFields, type ScoredSource } from "@/lib/board";
import VerdictScale from "@/components/VerdictScale";
import ScoreBreakdown from "@/components/ScoreBreakdown";

// One forecaster's card on a Right/Wrong Ray board: the day's score, the
// predicted line, the grade bar, and a "show the math" breakdown. Shared by the
// Boone board and every per-town board so the rubric renders identically.
export default function ScoredDayCard(
  { source, isBest, isWorst, anchorId }:
  { source: ScoredSource; isBest: boolean; isWorst: boolean; anchorId?: string },
) {
  const { label, iconSrc, iconChar, price, e } = source;
  const s = e.score.score;
  const f = predFields(e);
  return (
    <div id={anchorId}
      className={cn(
        "mt-3 scroll-mt-20 rounded-2xl border bg-background p-5 transition hover:-translate-y-0.5 hover:shadow-lg sm:p-6",
        isBest ? "border-emerald-300/70" : isWorst ? "border-orange-300/70" : "border-border"
      )}>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {iconSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={iconSrc} alt="" className="inline h-5 w-5 rounded-sm object-contain align-middle" />
          ) : iconChar ? (
            <span aria-hidden="true">{iconChar}</span>
          ) : null}
          <span className="ds-h4">{label}</span>
          {isBest && (
            <span className="rounded-full border border-green/30 bg-green/10 px-2.5 py-0.5 text-xs font-semibold text-green-700">
              day&apos;s best
            </span>
          )}
          {isWorst && (
            <span className="rounded-full border border-orange-600/40 bg-orange-600/10 px-2.5 py-0.5 text-xs font-semibold text-orange-600">
              day&apos;s worst
            </span>
          )}
        </span>
        <span className="justify-self-center rounded-full bg-surface px-2.5 py-0.5 text-xs font-semibold text-muted">
          {price}
        </span>
        <span className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
          <VerdictScale score={s} />
          <span className="ds-stat">
            {s.toFixed(1)}<span className="text-sm font-normal text-muted">/100</span>
          </span>
        </span>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-border" aria-hidden="true">
        <div className={cn("h-full rounded-full", barColor(s))} style={{ width: `${Math.max(2, Math.min(100, s))}%` }} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4 text-sm">
        <div>
          <div className="ds-caption">Predicted hi / lo</div>
          <div className="mt-0.5 font-medium">{f.hiLo}</div>
        </div>
        <div>
          <div className="ds-caption">Wind</div>
          <div className="mt-0.5 font-medium">{f.wind}</div>
        </div>
        <div>
          <div className="ds-caption">Rain</div>
          <div className="mt-0.5 font-medium">{f.rain}</div>
        </div>
      </div>
      <details className="group mt-4">
        <summary className="inline-flex cursor-pointer list-none items-center rounded text-sm font-medium text-teal [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">Show the math &darr;</span>
          <span className="hidden group-open:inline">Hide the math &uarr;</span>
        </summary>
        <div className="mt-2">
          <ScoreBreakdown score={e.score} />
        </div>
      </details>
    </div>
  );
}
