import { scaleLinear } from "@visx/scale";
import { LinePath } from "@visx/shape";
import { Group } from "@visx/group";
import type { ChartSeries } from "@/lib/leadtime";
import { FORECASTERS } from "@/lib/forecasters";

// The accuracy-decay chart on /right-wrong-ray: average score (the full
// 100-point model) by forecast lead time, one line per source. Unlike
// TrendChartInteractive this needs no tooltip or mode toggle, so it stays a
// SERVER component: same visx primitives (scaleLinear/LinePath/Group are
// hook-free), but a fixed viewBox scaled by CSS instead of the client-side
// ParentSize wrapper — no chart JS ships to the browser.

const W = 600, H = 300;
const M = { top: 12, right: 16, bottom: 40, left: 34 };
const IW = W - M.left - M.right;
const IH = H - M.top - M.bottom;

// Design language: orange is Ray's (the graded forecaster); the free field
// splits between the data-green family and slate, with dash variation so
// neighbors in the same family stay tellable in the legend.
const STYLE: Record<string, { color: string; width?: number; dash?: string }> = {
  // orange-300 is globals.css's designated orange for dark teal grounds
  // (5.6:1 on teal-700) — still brand orange, readable on this band.
  raysweather: { color: "var(--orange-300)", width: 2.6 },
  openmeteo: { color: "var(--green)", width: 2.4 },
  metno: { color: "#6ee7b7" },
  visualcrossing: { color: "#34d399", dash: "5 4" },
  tomorrowio: { color: "#a7f3d0", dash: "2 3" },
  googleweather: { color: "#d1fae5", dash: "5 4" },
  nws: { color: "#e2e8f0" },
  openweathermap: { color: "#cbd5e1", dash: "5 4" },
  weatherapi: { color: "#94a3b8", dash: "2 3" },
};
const FALLBACK_STYLE = { color: "#94a3b8" };

// Names sources on purpose: this page is the receipts page.
const EXTRA_LABELS: Record<string, string> = { raysweather: "Ray's Weather" };
const label = (key: string) => FORECASTERS[key]?.label ?? EXTRA_LABELS[key] ?? key;

export default function AccuracyDecayChart({ series }: { series: ChartSeries[] }) {
  const maxLead = Math.max(1, ...series.flatMap((s) => s.points.map((p) => p.lead)));
  // Floor the y axis one grid step under the worst charted score so a bad
  // stretch can't silently clip off the bottom (clamp would flatten it).
  const worst = Math.min(100, ...series.flatMap((s) => s.points.map((p) => p.value)));
  const yMin = Math.min(50, Math.floor(worst / 10) * 10);
  const x = scaleLinear({ domain: [0, maxLead], range: [0, IW] });
  const y = scaleLinear({ domain: [yMin, 100], range: [IH, 0] });

  // Legend reads merit-first (best same-day score at the top of the list);
  // draw order puts the emphasized pair on top of the field.
  const emphasis = (key: string) => (key === "raysweather" ? 2 : key === "openmeteo" ? 1 : 0);
  const legend = [...series].sort((a, b) => (b.points[0]?.value ?? 0) - (a.points[0]?.value ?? 0));
  const drawn = [...series].sort((a, b) => emphasis(a.source) - emphasis(b.source));
  const leads = Array.from({ length: maxLead + 1 }, (_, i) => i);

  return (
    // Capped width: in-viewBox text is sized for phone legibility (~10px
    // effective at 375px), so an uncapped desktop render would balloon it.
    <div className="mx-auto max-w-[600px]">
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.7rem] text-white/70">
        {legend.map(({ source }) => {
          const st = STYLE[source] ?? FALLBACK_STYLE;
          return (
            <span key={source} className="inline-flex items-center gap-1.5">
              <svg width="20" height="6" aria-hidden="true">
                <line x1="1" y1="3" x2="19" y2="3" stroke={st.color} strokeWidth={st.width ?? 2}
                  strokeDasharray={st.dash} strokeLinecap="round" />
              </svg>
              {label(source)}
            </span>
          );
        })}
      </div>

      {/* aria-label stays structural-descriptive; the editorial claim lives
          in the visible prose, where it's kept in sync with the data. */}
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img"
        aria-label={`Line chart of average accuracy score by forecast lead time, zero to ${maxLead} days, one line per forecaster`}>
        <Group left={M.left} top={M.top}>
          {[60, 75].map((v) => (
            <line key={v} x1={0} x2={IW} y1={y(v)} y2={y(v)}
              stroke="var(--color-border, #ffffff22)" strokeDasharray="3 4" />
          ))}
          <text x={IW - 4} y={y(75) - 5} textAnchor="end" fontSize={14} fill="#ffffff80">graded Right &#8805; 75</text>
          <text x={IW - 4} y={y(60) - 5} textAnchor="end" fontSize={14} fill="#ffffff80">Meh &#8805; 60</text>
          {[yMin, 100].map((v) => (
            <text key={v} x={-8} y={y(v) + 5} textAnchor="end" fontSize={17} fill="#ffffffb3">{v}</text>
          ))}

          {drawn.map(({ source, points }) => {
            const st = STYLE[source] ?? FALLBACK_STYLE;
            return (
              <Group key={source}>
                <LinePath data={points} x={(p) => x(p.lead)} y={(p) => y(p.value)}
                  stroke={st.color} strokeWidth={st.width ?? 1.5} strokeDasharray={st.dash} />
                {points.map((p) => (
                  <circle key={p.lead} cx={x(p.lead)} cy={y(p.value)} r={2.4} fill={st.color} />
                ))}
              </Group>
            );
          })}

          {leads.map((l) => (
            <text key={l} x={x(l)} y={IH + 19} textAnchor={l === 0 ? "start" : "middle"}
              fontSize={17} fill="#ffffffb3">
              {l === 0 ? "same day" : l}
            </text>
          ))}
          <text x={IW / 2} y={IH + 36} textAnchor="middle" fontSize={14} fill="#ffffff80">
            days ahead the forecast was published
          </text>
        </Group>
      </svg>

      <p className="mt-3 text-xs text-white/60">
        Lines stop where the data does: not every source publishes five days out, samples thin past
        day 3, and a lead is only charted once it holds at least 10 scored days. Ray&apos;s single
        day-5 row sits out until it accumulates.
      </p>

      <div className="sr-only">
        <table>
          <caption>Average accuracy score by forecast lead time</caption>
          <thead>
            <tr>
              <th scope="col">Source</th>
              {leads.map((l) => <th key={l} scope="col">{l === 0 ? "Same day" : `${l} days out`}</th>)}
            </tr>
          </thead>
          <tbody>
            {legend.map(({ source, points }) => (
              <tr key={source}>
                <th scope="row">{label(source)}</th>
                {leads.map((l) => <td key={l}>{points.find((p) => p.lead === l)?.value ?? "—"}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
