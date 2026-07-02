import { getLatestComparison, getScores, getLatestForecasts } from "@/lib/data";
import { scoreboardRows } from "@/lib/scoreboard";
import { HEADLINE_SOURCES, isProvisional } from "@/lib/gating";
import { sparkSeries } from "@/lib/sparkline";
import { actualLines, heroStats } from "@/lib/homeStats";
import { fmtLongDate } from "@/lib/dates";
import { FORECASTERS } from "@/lib/forecasters";
import { cn } from "@/lib/utils";
import VerdictScale from "@/components/VerdictScale";
import SectionBand from "@/components/SectionBand";
import SortableScoreTable, { type ScoreRow } from "@/components/SortableScoreTable";
import ScoreBreakdown from "@/components/ScoreBreakdown";
import UpcomingForecasts from "@/components/UpcomingForecasts";
import type { SourceEntry } from "@/lib/types";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";

export const metadata = { title: "Right Ray / Wrong Ray" };

// Display metadata for sources that live outside the FORECASTERS index map.
// Prices are what a reader pays to see the forecast; Ray's is the only one
// with a bill (owner to supply the exact figure).
const EXTRA_META: Record<string, { label: string; iconSrc?: string; iconChar?: string }> = {
  raysweather: { label: "Ray's Weather", iconSrc: "/assets/ray_face.svg" },
  apple_weather: { label: "Apple Weather", iconChar: "📱" },
};
const PRICES: Record<string, string> = { raysweather: "Paid" };

function srcMeta(key: string): { label: string; iconSrc?: string; iconChar?: string; price: string } {
  const f = FORECASTERS[key];
  const base = f ? { label: f.label, iconSrc: f.logo } : (EXTRA_META[key] ?? { label: key });
  return { ...base, price: PRICES[key] ?? "Free" };
}

function predFields(e: SourceEntry): { hiLo: string; wind: string; rain: string } {
  const p = e.prediction;
  const hi = p.today_high_f ?? p.high_f, lo = p.tonight_low_f ?? p.low_f;
  const wind = p.wind_mph, rain = p.precip_in ?? p.rainfall_in;
  return {
    hiLo: `${hi ?? "—"}° / ${lo ?? "—"}°`,
    wind: wind != null ? `${Math.round(wind * 10) / 10} mph` : "—",
    rain: rain != null ? `${rain}"` : "—",
  };
}

// Score bars read by grade band: Right (75+) green, Meh slate, Wrong orange.
function barColor(s: number): string {
  return s >= 75 ? "bg-green" : s >= 60 ? "bg-slate-400" : "bg-orange-600";
}

const datasetJsonLd = {
  "@context": "https://schema.org",
  "@type": "Dataset",
  "name": "Boone, NC forecast accuracy scores",
  "description":
    "Daily accuracy scores comparing Ray's Weather, Open-Meteo, and other forecasts for Boone and Deep Gap, NC against verified actual conditions.",
  "creator": { "@type": "Organization", "name": "Dave's Sweater", "url": "https://davessweater.com" },
  "isAccessibleForFree": true,
  "url": "https://davessweater.com/right-wrong-ray",
  "keywords": ["weather forecast accuracy", "Boone NC weather", "Ray's Weather", "Open-Meteo"],
  "distribution": [
    { "@type": "DataDownload", "encodingFormat": "text/csv", "contentUrl": "https://github.com/davidhluther/davessweater/blob/main/data/scores_export.csv" },
    { "@type": "DataDownload", "encodingFormat": "application/json", "contentUrl": "https://github.com/davidhluther/davessweater/blob/main/data/scores.json" },
  ],
};

export default async function Page() {
  const [comp, scores, forecasts] = await Promise.all([getLatestComparison(), getScores(), getLatestForecasts()]);
  const trackingDays = heroStats(scores).trackingDays;

  // Season scoreboard: every source we track, sparklines included.
  const allRows = scoreboardRows(scores);
  const spark = sparkSeries(scores, allRows.map((r) => r.key));
  const rows: ScoreRow[] = allRows.map((r) => ({
    key: r.key,
    label: r.label,
    isFree: r.key !== "raysweather",
    record: r.record,
    avg: r.avg,
    days: r.days,
    spark: spark[r.key] ?? [],
  }));
  const provisionalKeys = new Set(
    allRows.filter((r) => isProvisional(r.days) && !HEADLINE_SOURCES.has(r.key)).map((r) => r.key)
  );

  // Day cards run as a leaderboard: best score first, winner and loser marked.
  const scored = Object.keys(comp?.sources ?? {})
    .map((key) => ({ key, ...srcMeta(key), e: comp!.sources![key] }))
    .filter((s): s is typeof s & { e: SourceEntry & { score: NonNullable<SourceEntry["score"]> } } =>
      Boolean(s.e && s.e.score))
    .sort((x, y) => y.e.score.score - x.e.score.score);
  const bestScore = scored[0]?.e.score.score;
  const worstScore = scored[scored.length - 1]?.e.score.score;
  const markWorst = scored.length > 2 && worstScore !== bestScore;

  const a = comp?.actuals;
  const aLines = a ? actualLines(a) : [];
  const actualMain = aLines.slice(0, 3).join(" | ");
  const actualCond = aLines[3];

  return (
    <>
      <JsonLd data={datasetJsonLd} />

      {/* Branded page header: same band language as the homepage hero, none of its furniture */}
      <section className="w-full bg-teal-700 text-white">
        <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-12">
          <div className="text-xs font-bold uppercase tracking-wider text-orange-300">
            Tracked daily | {trackingDays} days on the record
          </div>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">Right Ray / Wrong Ray</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/70">
            When you trust us to tell you how many rays of sunshine, golfballs, or snowmen you can expect,
            we need to be held to account. Here&apos;s the scoreboard comparing each forecast to the actual weather.
          </p>
          <p className="mt-5">
            <Link href="/methodology"
              className="inline-flex min-h-10 items-center rounded-lg border border-white/30 px-4 text-sm font-bold text-white transition-colors hover:bg-white/10">
              How we score it &rarr;
            </Link>
          </p>
        </div>
      </section>

      {rows.length > 0 && (
        <section className="w-full border-t border-white/15 bg-teal-700 text-white">
          <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10">
            <h2 className="font-display mb-1 text-2xl font-bold">Season Scoreboard</h2>
            <p className="mb-4 text-sm text-white/70">
              Every forecaster we track, ranked by season average. The order is merit-based.
            </p>
            <SortableScoreTable rows={rows} />
            <p className="mt-3 text-xs text-white/70">W = graded Right (75+) | L = graded Wrong (under 60) | M = Meh (60&ndash;74)</p>
          </div>
        </section>
      )}

      <SectionBand tone="surface">
        {comp ? (
          <>
            <h2 className="font-display text-2xl font-bold">
              Latest scored day{comp.date ? <span className="text-muted"> | {fmtLongDate(comp.date)}</span> : null}
            </h2>
            <p className="mt-1 text-sm text-muted">
              Yesterday&apos;s forecasts, graded against what the sky actually did. The math is under each score.
            </p>

            {/* The reference every card below is judged against */}
            {a && (
              <div className="mt-4 rounded-2xl bg-teal-900 p-5 text-white sm:p-6 [background-image:radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:22px_22px]">
                <div className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-white/60">
                  What actually happened
                </div>
                <div className="mt-1.5 font-display text-lg font-bold sm:text-2xl">{actualMain}</div>
                {actualCond && <div className="mt-1 text-sm text-white/70">{actualCond}</div>}
              </div>
            )}

            {scored.map(({ key, label, iconSrc, iconChar, price, e }, i) => {
              const s = e.score.score;
              const isBest = s === bestScore;
              const isWorst = markWorst && i === scored.length - 1;
              const f = predFields(e);
              return (
                <div key={key}
                  className={cn(
                    "mt-3 rounded-2xl border bg-background p-5 transition hover:-translate-y-0.5 hover:shadow-lg sm:p-6",
                    isBest ? "border-emerald-300/70" : "border-border"
                  )}>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      {iconSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={iconSrc} alt="" className="inline h-5 w-5 rounded-sm object-contain align-middle" />
                      ) : iconChar ? (
                        <span aria-hidden="true">{iconChar}</span>
                      ) : null}
                      <span className="font-display text-base font-bold sm:text-lg">{label}</span>
                      {isBest && (
                        <span className="rounded-full border border-green/30 bg-green/10 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                          day&apos;s best
                        </span>
                      )}
                      {isWorst && (
                        <span className="rounded-full border border-slate-400/40 bg-slate-400/10 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                          day&apos;s worst
                        </span>
                      )}
                    </span>
                    <span className="justify-self-center rounded-full bg-surface px-2.5 py-0.5 text-xs font-semibold text-muted">
                      {price}
                    </span>
                    <span className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
                      <VerdictScale score={s} iconSrc={iconSrc} iconChar={iconChar} />
                      <span className="font-display text-2xl font-bold sm:text-3xl">
                        {s.toFixed(1)}<span className="text-sm font-normal text-muted">/100</span>
                      </span>
                    </span>
                  </div>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-border" aria-hidden="true">
                    <div className={cn("h-full rounded-full", barColor(s))} style={{ width: `${Math.max(2, Math.min(100, s))}%` }} />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4 text-sm">
                    <div>
                      <div className="text-xs text-muted">Predicted hi / lo</div>
                      <div className="mt-0.5 font-medium">{f.hiLo}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted">Wind</div>
                      <div className="mt-0.5 font-medium">{f.wind}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted">Rain</div>
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
            })}
          </>
        ) : <p className="text-muted">No comparison yet.</p>}
        <p className="mt-5 text-xs italic text-muted">
          Each forecast is scored out of 100 across five fields — high temp (30), low temp (30), wind (20,
          scored as a range when the source gives one), precip type (10) and precip amount (10) — by closeness
          to the actual recorded conditions. A forecast of &ldquo;no rain&rdquo; counts as a zero-inch prediction
          (scored); predicting rain with no stated total leaves the amount blank (no credit).
        </p>
        <p className="mt-2 text-xs">
          <Link href="/methodology" className="text-teal underline underline-offset-2">Full methodology &rarr;</Link>
        </p>
      </SectionBand>

      <SectionBand tone="light">
        <h2 className="font-display mb-1 text-2xl font-bold">What they&apos;re predicting now</h2>
        <UpcomingForecasts data={forecasts} provisional={provisionalKeys} />
      </SectionBand>

    </>
  );
}
