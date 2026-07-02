import { getLatestComparison, getScores, getLatestForecasts } from "@/lib/data";
import { scoreboardRows, otherSourcesRows } from "@/lib/scoreboard";
import { MIN_SCORED_DAYS } from "@/lib/gating";
import { sparkSeries } from "@/lib/sparkline";
import { actualLines, heroStats } from "@/lib/homeStats";
import { cn } from "@/lib/utils";
import RayFaces from "@/components/RayFaces";
import SectionBand from "@/components/SectionBand";
import SortableScoreTable, { type ScoreRow } from "@/components/SortableScoreTable";
import OtherSourcesBoard from "@/components/OtherSourcesBoard";
import ScoreBreakdown from "@/components/ScoreBreakdown";
import UpcomingForecasts from "@/components/UpcomingForecasts";
import type { SourceEntry } from "@/lib/types";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { type ReactNode } from "react";

export const metadata = { title: "Right Ray / Wrong Ray" };

const SOURCES: Array<{ key: "raysweather" | "openmeteo" | "apple_weather"; label: string; icon: ReactNode }> = [
  {
    key: "raysweather",
    label: "Ray's Weather",
    // eslint-disable-next-line @next/next/no-img-element
    icon: <img src="/assets/ray_face.svg" alt="" className="inline h-5 w-5 align-middle" />,
  },
  { key: "openmeteo", label: "Open-Meteo", icon: <span aria-hidden="true">🌐</span> },
  { key: "apple_weather", label: "Apple Weather", icon: <span aria-hidden="true">📱</span> },
];

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

const META: Record<string, { isFree: boolean }> = {
  "Open-Meteo": { isFree: true },
  "Ray's Weather": { isFree: false },
};

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
  const spark = sparkSeries(scores, ["openmeteo", "raysweather"]);
  const rows: ScoreRow[] = scoreboardRows(scores)
    .filter((r) => r.label === "Open-Meteo" || r.label === "Ray's Weather")
    .map((r) => ({
      key: r.label,
      label: r.label,
      isFree: META[r.label]?.isFree ?? true,
      record: r.record,
      avg: r.avg,
      days: r.days,
      spark: r.label === "Open-Meteo" ? spark.openmeteo : spark.raysweather,
    }));
  const otherRows = otherSourcesRows(scores);
  const provisionalKeys = new Set(otherRows.filter((r) => r.provisional).map((r) => r.key));
  const a = comp?.actuals;

  // Day cards run as a leaderboard: best score first, the winner marked.
  const scored = SOURCES
    .map((s) => ({ ...s, e: comp?.sources?.[s.key] }))
    .filter((s): s is typeof s & { e: SourceEntry & { score: NonNullable<SourceEntry["score"]> } } =>
      Boolean(s.e && s.e.score))
    .sort((x, y) => y.e.score.score - x.e.score.score);
  const bestScore = scored[0]?.e.score.score;

  const aLines = a ? actualLines(a) : [];
  const actualMain = aLines.slice(0, 3).join(" · ");
  const actualCond = aLines[3];

  return (
    <>
      <JsonLd data={datasetJsonLd} />

      {/* Branded page header: same band language as the homepage hero, none of its furniture */}
      <section className="w-full bg-teal-700 text-white">
        <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-12">
          <div className="text-xs font-bold uppercase tracking-wider text-orange-300">
            Tracked daily · {trackingDays} days on the record
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

      <SectionBand tone="surface">
        {comp ? (
          <>
            <h2 className="font-display text-2xl font-bold">
              Latest scored day{comp.date ? <span className="text-muted"> · {comp.date}</span> : null}
            </h2>

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

            {scored.map(({ key, label, icon, e }) => {
              const s = e.score.score;
              const isBest = s === bestScore;
              const f = predFields(e);
              return (
                <div key={key}
                  className={cn("mt-3 rounded-2xl border bg-background p-5 sm:p-6",
                    isBest ? "border-emerald-300/70" : "border-border")}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="font-display text-lg font-bold">{icon} {label}</span>
                    {isBest && (
                      <span className="rounded-full border border-green/30 bg-green/10 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                        day&apos;s best
                      </span>
                    )}
                    <span className="ml-auto flex items-center gap-3">
                      <RayFaces score={s} />
                      <span className="font-display text-2xl font-bold sm:text-3xl">
                        {s.toFixed(1)}<span className="text-sm font-normal text-muted">/100</span>
                      </span>
                    </span>
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

      {rows.length > 0 && (
        <SectionBand tone="dark">
          <h2 className="font-display mb-4 text-2xl font-bold">Season Scoreboard</h2>

          <SortableScoreTable rows={rows} />

          <p className="mt-3 text-xs text-white/70">W = graded Right (75+) · L = graded Wrong (under 60) · M = Meh (60&ndash;74)</p>
        </SectionBand>
      )}

      {otherRows.length > 0 && (
        <SectionBand tone="surface">
          <h2 className="font-display mb-1 text-2xl font-bold">The rest of the field</h2>
          <p className="mb-4 mt-1 text-sm text-muted">
            Ray&apos;s is the headline, but he&apos;s not the only forecast in town. We track these free, automated
            services against the same actuals, scored the same way. A new one stays provisional until it has{" "}
            {MIN_SCORED_DAYS} scored days.
          </p>
          <OtherSourcesBoard rows={otherRows} />
          <p className="mt-4 text-xs">
            <Link href="/methodology" className="text-teal underline underline-offset-2">How we score it &rarr;</Link>
          </p>
        </SectionBand>
      )}

    </>
  );
}
