import { getLatestComparison, getScores, getLatestForecasts } from "@/lib/data";
import { getLeadtimeScores, decayChartSeries } from "@/lib/leadtime";
import { scoreboardRows } from "@/lib/scoreboard";
import { HEADLINE_SOURCES, isProvisional } from "@/lib/gating";
import { sparkSeries, rollingMean } from "@/lib/sparkline";
import { actualLines, heroStats } from "@/lib/homeStats";
import { fmtLongDate } from "@/lib/dates";
import { FORECASTERS } from "@/lib/forecasters";
import { cn } from "@/lib/utils";
import VerdictScale from "@/components/VerdictScale";
import SectionBand from "@/components/SectionBand";
import SortableScoreTable, { type ScoreRow } from "@/components/SortableScoreTable";
import ScoreBreakdown from "@/components/ScoreBreakdown";
import AccuracyDecayChart from "@/components/AccuracyDecayChart";
import UpcomingForecasts from "@/components/UpcomingForecasts";
import type { SourceEntry } from "@/lib/types";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";

export const metadata = {
  title: "Right Ray / Wrong Ray: Boone forecast accuracy scoreboard",
  description:
    "Daily accuracy scores for every Boone, NC forecast (Ray's Weather, Open-Meteo, Apple Weather, and seven more), graded against verified actuals on a 100-point scale.",
  alternates: { canonical: "/right-wrong-ray" },
  openGraph: {
    title: "Right Ray / Wrong Ray: Boone forecast accuracy scoreboard",
    description:
      "Who actually got Boone's weather right? Every forecast graded daily against what happened, receipts included.",
    url: "https://davessweater.com/right-wrong-ray",
    type: "website",
  },
  twitter: { card: "summary_large_image" as const },
};

// Display metadata for sources that live outside the FORECASTERS index map.
// Prices are what a reader pays to see the forecast; Ray's is the only one
// with a bill (owner to supply the exact figure).
const EXTRA_META: Record<string, { label: string; iconSrc?: string; iconChar?: string }> = {
  raysweather: { label: "Ray's Weather", iconSrc: "/assets/ray_face.svg" },
  apple_weather: { label: "Apple Weather", iconChar: "📱" },
  composite: { label: "Dave's Sweater Index" },
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
  "license": "https://creativecommons.org/licenses/by/4.0/",
  "url": "https://davessweater.com/right-wrong-ray",
  "keywords": ["weather forecast accuracy", "Boone NC weather", "Ray's Weather", "Open-Meteo"],
  "distribution": [
    { "@type": "DataDownload", "encodingFormat": "text/csv", "contentUrl": "https://github.com/davidhluther/davessweater/blob/main/data/scores_export.csv" },
    { "@type": "DataDownload", "encodingFormat": "application/json", "contentUrl": "https://github.com/davidhluther/davessweater/blob/main/data/scores.json" },
  ],
};

export default async function Page() {
  const [comp, scores, forecasts, leadtime] = await Promise.all([
    getLatestComparison(), getScores(), getLatestForecasts(), getLeadtimeScores(),
  ]);
  const trackingDays = heroStats(scores).trackingDays;
  // Accuracy-decay section gates on usable data (2+ sources with 2+ charted
  // points) — the whole section renders nothing otherwise.
  const decay = decayChartSeries(leadtime);

  // Season scoreboard: every source we track, sparklines included.
  const allRows = scoreboardRows(scores);
  const spark = sparkSeries(scores, allRows.map((r) => r.key));
  const rows: ScoreRow[] = allRows.map((r) => ({
    key: r.key,
    label: r.label,
    isFree: r.key !== "raysweather",
    // The DSI is our own consensus — flagged so the standings mark it as ours
    // rather than reading it as just another third-party forecaster.
    own: r.key === "composite",
    record: r.record,
    avg: r.avg,
    days: r.days,
    spark: rollingMean(spark[r.key] ?? []),
  }));
  const provisionalKeys = new Set(
    allRows.filter((r) => isProvisional(r.days) && !HEADLINE_SOURCES.has(r.key)).map((r) => r.key)
  );

  // The Dave's Sweater Index gets a featured block of its own — season standing
  // plus its rank against the field — so our forecast leads the page instead of
  // hiding in row three.
  const dsiRow = allRows.find((r) => r.key === "composite") ?? null;
  const dsiRank = dsiRow
    ? [...allRows].sort((x, y) => y.avg - x.avg).findIndex((r) => r.key === "composite") + 1
    : null;

  // Day cards run as a leaderboard: best score first. Tied scores break on the
  // summed miss across the graded "show the math" fields (the closer forecast
  // ranks higher), so "day's best" and "day's worst" each land on exactly one
  // card even when the headline numbers match.
  const missTotal = (score: SourceEntry["score"]): number => {
    let sum = 0, n = 0;
    for (const f of Object.values(score.breakdown ?? {})) {
      if (f.scored && typeof f.error === "number") { sum += Math.abs(f.error); n++; }
    }
    return n ? sum : Number.MAX_SAFE_INTEGER;
  };
  // The DSI is featured on its own (below) — keep it out of the member leaderboard
  // so it doesn't compete against the very sources it averages for "day's best".
  const dsiDay = comp?.sources?.composite;
  const dsiScored = dsiDay && dsiDay.score ? (dsiDay as SourceEntry & { score: NonNullable<SourceEntry["score"]> }) : null;
  const scored = Object.keys(comp?.sources ?? {})
    .filter((key) => key !== "composite")
    .map((key) => ({ key, ...srcMeta(key), e: comp!.sources![key] }))
    .filter((s): s is typeof s & { e: SourceEntry & { score: NonNullable<SourceEntry["score"]> } } =>
      Boolean(s.e && s.e.score))
    .sort((x, y) =>
      y.e.score.score - x.e.score.score ||
      missTotal(x.e.score) - missTotal(y.e.score) ||
      x.label.localeCompare(y.label));
  const bestScore = scored[0]?.e.score.score;
  const worstScore = scored[scored.length - 1]?.e.score.score;
  const markWorst = scored.length > 2 && worstScore !== bestScore;
  const hasRay = scored.some((s) => s.key === "raysweather");

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
          <div className="ds-kicker text-orange-300">
            Tracked daily | {trackingDays} days on the record
          </div>
          <h1 className="mt-1 ds-h1">Right Ray / Wrong Ray</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/70">
            Every forecast is a claim about tomorrow. This scoreboard grades every one we track, free
            and paid alike, against what the sky actually did. Same rubric for everybody.
          </p>
          <p className="mt-5 flex flex-wrap gap-3">
            {hasRay && (
              <a href="#rays-latest"
                className="inline-flex min-h-10 items-center rounded-lg bg-orange-600 px-4 text-sm font-bold text-white transition-colors hover:bg-[#9a3412]">
                How Ray did &darr;
              </a>
            )}
            <Link href="/methodology"
              className="inline-flex min-h-10 items-center rounded-lg border border-white/30 px-4 text-sm font-bold text-white transition-colors hover:bg-white/10">
              How we score it
            </Link>
          </p>
          {/* The two long-form reads. They used to trail the page as a plain
              "The longer story:" line under the rubric footnote; moved up and
              given card treatment 2026-07-27 (owner) so the analysis is offered
              where a reader is deciding whether the scoreboard is credible. */}
          <div className="mt-6 grid gap-2 sm:grid-cols-2 sm:max-w-2xl">
            <Link href="/resources/articles/is-rays-weather-accurate"
              className="group rounded-xl border border-white/20 bg-white/5 p-3 transition-colors hover:border-white/40 hover:bg-white/10">
              <div className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-orange-300">
                The long read
              </div>
              <div className="mt-1 text-sm font-bold text-white">
                Is Ray&apos;s Weather Accurate? 118 Days Scored
              </div>
            </Link>
            <Link href="/report-card/2026-06"
              className="group rounded-xl border border-white/20 bg-white/5 p-3 transition-colors hover:border-white/40 hover:bg-white/10">
              <div className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-orange-300">
                Monthly report card
              </div>
              <div className="mt-1 text-sm font-bold text-white">
                Ray&apos;s Weather Report Card: June 2026
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Dave's Sweater Index — featured on its own. Our consensus leads the page,
          graded on the same rubric, before the field it aggregates. */}
      {dsiRow && (
        <section className="w-full bg-surface text-foreground">
          <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10">
            <div className="ds-kicker text-muted">Our forecast</div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="ds-h2">
                Dave&apos;s Sweater Index
              </h2>
              {dsiRank && (
                <span className="rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-semibold text-muted">
                  #{dsiRank} of {allRows.length}
                </span>
              )}
            </div>
            <p className="mt-2 max-w-2xl ds-body text-muted">
              Our own forecast, built from the free forecasters below and graded by the exact same rubric as
              every one of them. It is not a plain average. The rules that combine them are published, and
              they are why it outscores its own members. No résumé, no paywall.
            </p>
            <div className="mt-5 grid grid-cols-3 gap-3 sm:max-w-md">
              <div className="rounded-xl border border-border bg-background px-3 py-3">
                <div className="ds-stat">{dsiRow.avg.toFixed(1)}</div>
                <div className="mt-0.5 ds-caption">Season avg / 100</div>
              </div>
              <div className="rounded-xl border border-border bg-background px-3 py-3">
                <div className="ds-stat">{dsiRow.record.split(" ")[0]}</div>
                <div className="mt-0.5 ds-caption">Graded Right</div>
              </div>
              <div className="rounded-xl border border-border bg-background px-3 py-3">
                <div className="ds-stat">{dsiRow.days}</div>
                <div className="mt-0.5 ds-caption">Days scored</div>
              </div>
            </div>
            {dsiScored && (
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 ds-body text-muted">
                <span className="font-semibold text-foreground">Latest scored day:</span>
                <span className="ds-stat text-xl text-foreground">{dsiScored.score.score.toFixed(1)}<span className="text-sm font-normal text-muted">/100</span></span>
                {typeof dsiDay?.prediction?.member_count === "number" && (
                  <span>from {dsiDay.prediction.member_count} forecasters</span>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* The scoreboard sits on its own darker plane — same dot-grid ground as the
          "what actually happened" card and the homepage "why we exist" band — so the
          header and the ten-row table read as two surfaces, not one slab. */}
      {rows.length > 0 && (
        <section className="w-full bg-teal-900 text-white [background-image:radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:22px_22px]">
          <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10">
            <h2 className="mb-1 ds-h2">Season Scoreboard</h2>
            <p className="mb-4 text-sm text-white/70">
              Every forecaster we track, ranked by season average. Our own{" "}
              <span className="font-semibold text-white/90">Dave&apos;s Sweater Index</span> (marked{" "}
              <span className="font-semibold text-emerald-300">ours</span>) is graded right in the mix. The order
              is merit-based.
            </p>
            <SortableScoreTable rows={rows} />
            <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/70">
              <div className="flex items-center gap-1.5"><dt className="font-semibold text-white">R</dt><dd>Right, 75+</dd></div>
              <div className="flex items-center gap-1.5"><dt className="font-semibold text-white">M</dt><dd>Meh, 60 to 74</dd></div>
              <div className="flex items-center gap-1.5"><dt className="font-semibold text-white">W</dt><dd>Wrong, under 60</dd></div>
              <div className="flex items-center gap-1.5"><dt className="font-semibold text-white">Trend</dt><dd>7-day rolling average</dd></div>
            </dl>
          </div>
        </section>
      )}

      {/* Accuracy by lead time — how each source's score decays as the
          forecast reaches further out. Gated: renders only when the artifact
          holds enough data to draw a comparison. */}
      {decay && (
        <SectionBand tone="dark">
          <h2 className="mb-1 ds-h2">How far out can you trust a forecast?</h2>
          {/* data-dependent claim — re-verify against leadtime_scores when editing */}
          <p className="mb-4 max-w-2xl text-sm text-white/70">
            The same 100-point grading, applied to the forecast each source published up to five days
            ahead. The free forecasts win at every horizon, and the gap widens at days 3 and 4: Ray&apos;s
            extended days publish fewer scoreable fields, and under the published rules a blank earns
            nothing. Our own <span className="font-semibold text-white">Dave&apos;s Sweater Index</span>{" "}
            (the bold white line) stays near the top clear out to day five, because a consensus barely fades
            when no single source has to carry it.
          </p>
          <AccuracyDecayChart series={decay} />
          <p className="mt-2 text-xs">
            <Link href="/methodology" className="font-medium text-white/85 underline underline-offset-2">
              How lead-time scoring works
            </Link>
          </p>
        </SectionBand>
      )}

      <SectionBand tone="surface">
        {comp ? (
          <>
            <h2 className="ds-h2">
              Latest scored day{comp.date ? <span className="text-muted"> | {fmtLongDate(comp.date)}</span> : null}
            </h2>
            <p className="mt-1 ds-body text-muted">
              Yesterday&apos;s forecasts, graded against what the sky actually did. The math is under each score.
            </p>

            {/* The reference every card below is judged against */}
            {a && (
              <div className="mt-4 rounded-2xl bg-teal-900 p-5 text-white sm:p-6 [background-image:radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:22px_22px]">
                <div className="ds-kicker text-white/60">
                  What actually happened
                </div>
                <div className="mt-1.5 ds-stat">{actualMain}</div>
                {actualCond && <div className="mt-1 text-sm text-white/70">{actualCond}</div>}
              </div>
            )}

            {scored.map(({ key, label, iconSrc, iconChar, price, e }, i) => {
              const s = e.score.score;
              const isBest = i === 0 && scored.length >= 2;
              const isWorst = markWorst && i === scored.length - 1;
              const f = predFields(e);
              return (
                <div key={key} id={key === "raysweather" ? "rays-latest" : undefined}
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
            })}
          </>
        ) : <p className="text-muted">No comparison yet.</p>}
        {/* Collapsed 2026-07-27 (owner: "we have too much... this needs to feel
            like a cleaner website"). The full rubric, the implied-zero rule and
            the tie-break all live on /methodology, one link away. */}
        <p className="mt-5 ds-caption">
          Every forecast is scored out of 100 on temperature, wind, and precipitation, against what actually
          happened.{" "}
          <Link href="/methodology" className="text-teal underline underline-offset-2">Full methodology</Link>
        </p>
      </SectionBand>

      <SectionBand tone="light">
        <h2 className="mb-1 ds-h2">What they&apos;re predicting now</h2>
        <UpcomingForecasts data={forecasts} provisional={provisionalKeys} />
      </SectionBand>

    </>
  );
}
