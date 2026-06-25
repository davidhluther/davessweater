import { getLatestComparison, getScores, getLatestForecasts } from "@/lib/data";
import { scoreboardRows } from "@/lib/scoreboard";
import { sparkSeries } from "@/lib/sparkline";
import { actualLines } from "@/lib/homeStats";
import RayFaces from "@/components/RayFaces";
import SectionBand from "@/components/SectionBand";
import SortableScoreTable, { type ScoreRow } from "@/components/SortableScoreTable";
import CoverageMatrix from "@/components/CoverageMatrix";
import ScoreBreakdown from "@/components/ScoreBreakdown";
import UpcomingForecasts from "@/components/UpcomingForecasts";
import type { SourceEntry } from "@/lib/types";
import { Fragment, type ReactNode } from "react";

export const metadata = { title: "Right Ray / Wrong Ray" };

const SOURCES: Array<{ key: "raysweather" | "openmeteo" | "apple_weather"; label: string; icon: ReactNode }> = [
  {
    key: "raysweather",
    label: "Ray's Weather",
    // eslint-disable-next-line @next/next/no-img-element
    icon: <img src="/assets/ray_face.svg" alt="" className="inline h-5 w-5 align-middle" />,
  },
  { key: "openmeteo", label: "Open-Meteo", icon: "🌐" },
  { key: "apple_weather", label: "Apple Weather", icon: "📱" },
];

function predLines(e: SourceEntry): string[] {
  const p = e.prediction;
  const hi = p.today_high_f ?? p.high_f, lo = p.tonight_low_f ?? p.low_f;
  const wind = p.wind_mph, rain = p.precip_in ?? p.rainfall_in;
  return [
    `Hi: ${hi ?? "N/A"}° / Lo: ${lo ?? "N/A"}°`,
    wind != null ? `Wind: ${Math.round(wind * 10) / 10} mph` : "Wind: —",
    rain != null ? `Rain: ${rain}"` : "Rain: —",
  ];
}


const META: Record<string, { isFree: boolean }> = {
  "Open-Meteo": { isFree: true },
  "Ray's Weather": { isFree: false },
};

export default async function Page() {
  const [comp, scores, forecasts] = await Promise.all([getLatestComparison(), getScores(), getLatestForecasts()]);
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
  const a = comp?.actuals;
  return (
    <>
      <SectionBand tone="surface">
        <h2 className="font-display text-2xl font-bold">Right Ray / Wrong Ray</h2>
        <p className="mb-4 mt-1 text-sm text-muted">
          When you trust us to tell you how many rays of sunshine, golfballs, or snowmen you can expect,
          we need to be held to account. Here&apos;s the scoreboard comparing each forecast to the actual weather.
        </p>
        {comp ? (
          <>
            {/* Desktop table — hidden on mobile */}
            <table className="hidden w-full text-sm sm:table">
              <thead>
                <tr className="text-left text-muted">
                  <th className="py-2">Source</th>
                  <th>Predicted</th>
                  <th>Score</th>
                  <th>Verdict</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border font-semibold">
                  <td className="py-2">Actual{comp.date ? ` (${comp.date})` : ""}</td>
                  <td>{a ? actualLines(a).map((l, i) => <div key={i}>{l}</div>) : "—"}</td>
                  <td colSpan={2}>—</td>
                </tr>
                {SOURCES.map(({ key, label, icon }) => {
                  const e = comp.sources?.[key];
                  if (!e || !e.score) return null;
                  return (
                    <Fragment key={key}>
                      <tr className="border-t border-border">
                        <td className="py-2">{icon} {label}</td>
                        <td>{predLines(e).map((l, i) => <div key={i}>{l}</div>)}</td>
                        <td><strong>{e.score.score.toFixed(1)}/100</strong></td>
                        <td><RayFaces score={e.score.score} /></td>
                      </tr>
                      <tr>
                        <td colSpan={4} className="pb-3">
                          <ScoreBreakdown score={e.score} />
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile cards — hidden on sm+ */}
            <div className="space-y-2 sm:hidden">
              {a && (
                <div className="rounded-xl border border-border bg-background p-3">
                  <div className="font-display font-bold text-teal">Actual{comp.date ? ` (${comp.date})` : ""}</div>
                  <div className="mt-1 text-sm text-foreground">{actualLines(a).map((l, i) => <div key={i}>{l}</div>)}</div>
                </div>
              )}
              {SOURCES.map(({ key, label, icon }) => {
                const e = comp.sources?.[key];
                if (!e || !e.score) return null;
                return (
                  <div key={key} className="rounded-xl border border-border bg-background p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-display font-bold">{icon} {label}</span>
                      <span className="text-sm font-bold">{e.score.score.toFixed(1)}/100</span>
                    </div>
                    <div className="mt-1 text-sm text-muted">{predLines(e).map((l, i) => <div key={i}>{l}</div>)}</div>
                    <div className="mt-1"><RayFaces score={e.score.score} /></div>
                    <ScoreBreakdown score={e.score} />
                  </div>
                );
              })}
            </div>
          </>
        ) : <p className="text-muted">No comparison yet.</p>}
        <p className="mt-4 text-xs italic text-muted">
          Each source is scored out of 100 across four fields: high temp (30), low temp (30), wind (20),
          precipitation (20), based on closeness to actual recorded conditions.
        </p>
      </SectionBand>

      <SectionBand tone="light">
        <h2 className="font-display mb-1 text-2xl font-bold">What they&apos;re predicting now</h2>
        <UpcomingForecasts data={forecasts} />
      </SectionBand>

      {rows.length > 0 && (
        <SectionBand tone="light">
          <h2 className="font-display mb-4 text-2xl font-bold">Season Scoreboard</h2>

          <SortableScoreTable rows={rows} />

          <p className="mt-3 text-xs text-muted">W = graded Right (75+) · L = graded Wrong (under 60) · M = Meh (60&ndash;74)</p>
        </SectionBand>
      )}

      <SectionBand tone="surface">
        <h2 className="font-display mb-4 text-2xl font-bold">What Each Service Reports</h2>
        <CoverageMatrix scores={scores} />
      </SectionBand>
    </>
  );
}
