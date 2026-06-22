import { getLatestComparison, getScores } from "@/lib/data";
import { scoreboardRows } from "@/lib/scoreboard";
import RayFaces from "@/components/RayFaces";
import SectionBand from "@/components/SectionBand";
import type { SourceEntry, Actuals } from "@/lib/types";
import type { ReactNode } from "react";

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

function actualLines(a: Actuals): string[] {
  const lines = [`Hi: ${a.high_f ?? "N/A"}° / Lo: ${a.low_f ?? "N/A"}°`];
  if (a.wind_mph != null) lines.push(`Wind: ${Math.round(a.wind_mph * 10) / 10} mph`);
  if (a.snow_in != null && a.snow_in > 0.01) {
    const rain = a.precip_in != null ? Math.round((a.precip_in - a.snow_in) * 100) / 100 : null;
    lines.push(rain != null ? `Snow: ${a.snow_in}" / Rain: ${rain}"` : `Snow: ${a.snow_in}"`);
  } else if (a.precip_in != null) {
    lines.push(`Rain: ${a.precip_in}"`);
  }
  if (a.conditions) lines.push(a.conditions);
  return lines;
}

export default async function Page() {
  const [comp, scores] = await Promise.all([getLatestComparison(), getScores()]);
  const rows = scoreboardRows(scores);
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
                    <tr key={key} className="border-t border-border">
                      <td className="py-2">{icon} {label}</td>
                      <td>{predLines(e).map((l, i) => <div key={i}>{l}</div>)}</td>
                      <td><strong>{e.score.score.toFixed(1)}/100</strong></td>
                      <td><RayFaces score={e.score.score} /></td>
                    </tr>
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

      {rows.length > 0 && (
        <SectionBand tone="light">
          <h2 className="font-display mb-4 text-2xl font-bold">Season Scoreboard</h2>

          {/* Desktop table — hidden on mobile */}
          <table className="hidden w-full text-sm sm:table">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-2">Source</th>
                <th>Record</th>
                <th>Avg Score</th>
                <th>Days</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-t border-border">
                  <td className="py-2 font-semibold">{r.label}</td>
                  <td>{r.record}</td>
                  <td>{r.avg.toFixed(1)}/100</td>
                  <td>{r.days}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile cards — hidden on sm+ */}
          <ul className="space-y-2 sm:hidden">
            {rows.map((r) => (
              <li key={r.label} className="rounded-xl border border-border bg-background p-3">
                <div className="font-display font-bold text-teal">{r.label}</div>
                <div className="mt-1 grid grid-cols-3 gap-2 text-xs text-muted">
                  <span>Record<br /><span className="text-foreground">{r.record}</span></span>
                  <span>Avg<br /><span className="text-foreground">{r.avg.toFixed(1)}/100</span></span>
                  <span>Days<br /><span className="text-foreground">{r.days}</span></span>
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-3 text-xs text-muted">W = best forecast that day · L = worst · M = somewhere in the middle</p>
        </SectionBand>
      )}
    </>
  );
}
