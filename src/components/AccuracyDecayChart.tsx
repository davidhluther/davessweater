"use client";
import { useState } from "react";
import { scaleLinear } from "@visx/scale";
import { LinePath } from "@visx/shape";
import { Group } from "@visx/group";
import type { ChartSeries } from "@/lib/leadtime";
import { FORECASTERS } from "@/lib/forecasters";

// The accuracy-decay chart on /right-wrong-ray: average score (the full
// 100-point model) by forecast lead time, one line per source. Client
// component so a reader can click a line (or its legend entry) to isolate it —
// the picked line stays lit while the rest dim, and its legend entry highlights
// in step. Click it again (or its name) to show everything. The sr-only table
// below carries the same numbers for keyboard/screen-reader users.

const W = 600, H = 330;
const M = { top: 14, right: 18, bottom: 58, left: 78 };
const IW = W - M.left - M.right;
const IH = H - M.top - M.bottom;

// Design language: orange is Ray's (the graded forecaster); the free field
// splits between the data-green family and slate, with dash variation so
// neighbors in the same family stay tellable in the legend. orange-300 is
// globals.css's designated orange for dark teal grounds (5.6:1 on teal-700).
const STYLE: Record<string, { color: string; width?: number; dash?: string }> = {
  // Our own consensus reads as the hero line: bold and white, distinct from both
  // Ray's orange and the green free field.
  composite: { color: "#ffffff", width: 3.2 },
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
const EXTRA_LABELS: Record<string, string> = { raysweather: "Ray's Weather", composite: "Dave's Sweater Index" };
const label = (key: string) => FORECASTERS[key]?.label ?? EXTRA_LABELS[key] ?? key;

export default function AccuracyDecayChart({ series }: { series: ChartSeries[] }) {
  const [picked, setPicked] = useState<string | null>(null);
  const toggle = (key: string) => setPicked((p) => (p === key ? null : key));

  const maxLead = Math.max(1, ...series.flatMap((s) => s.points.map((p) => p.lead)));
  // Floor the y axis one grid step under the worst charted score so a bad
  // stretch can't silently clip off the bottom (clamp would flatten it).
  const worst = Math.min(100, ...series.flatMap((s) => s.points.map((p) => p.value)));
  const yMin = Math.min(50, Math.floor(worst / 10) * 10);
  const x = scaleLinear({ domain: [0, maxLead], range: [0, IW] });
  const y = scaleLinear({ domain: [yMin, 100], range: [IH, 0] });

  // Legend reads merit-first (best same-day score at the top of the list);
  // draw order puts the emphasized pair on top of the field.
  const emphasis = (key: string) =>
    key === "composite" ? 3 : key === "raysweather" ? 2 : key === "openmeteo" ? 1 : 0;
  const legend = [...series].sort((a, b) => (b.points[0]?.value ?? 0) - (a.points[0]?.value ?? 0));
  const drawn = [...series].sort((a, b) => emphasis(a.source) - emphasis(b.source));
  const leads = Array.from({ length: maxLead + 1 }, (_, i) => i);
  const dim = (source: string) => (picked && picked !== source ? 0.14 : 1);

  return (
    // Capped width: in-viewBox text is sized for phone legibility (~10px
    // effective at 375px), so an uncapped desktop render would balloon it.
    <div className="mx-auto max-w-[600px]">
      <div className="mb-1 flex flex-wrap items-center gap-x-1 gap-y-1 text-[0.7rem]">
        {legend.map(({ source }) => {
          const st = STYLE[source] ?? FALLBACK_STYLE;
          const on = picked === source;
          return (
            <button
              key={source}
              type="button"
              onClick={() => toggle(source)}
              aria-pressed={on}
              className={`inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 transition-colors ${
                on ? "bg-white/15 font-semibold text-white" : "text-white/70 hover:text-white"
              } ${picked && !on ? "opacity-50" : ""}`}
            >
              <svg width="20" height="6" aria-hidden="true">
                <line x1="1" y1="3" x2="19" y2="3" stroke={st.color} strokeWidth={st.width ?? 2}
                  strokeDasharray={st.dash} strokeLinecap="round" />
              </svg>
              {label(source)}
            </button>
          );
        })}
      </div>
      <p className="mb-2 text-[0.7rem] text-white/50">
        {picked ? `Showing ${label(picked)} — tap it again for all.` : "Tap a line or a name to isolate it."}
      </p>

      {/* aria-label stays structural-descriptive; the editorial claim lives in
          the visible prose, where it's kept in sync with the data. */}
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img"
        aria-label={`Line chart of average accuracy score by forecast lead time, zero to ${maxLead} days, one line per forecaster`}>
        <Group left={M.left} top={M.top}>
          {/* grade-threshold gridlines */}
          {[60, 75].map((v) => (
            <line key={v} x1={0} x2={IW} y1={y(v)} y2={y(v)} stroke="#ffffff22" strokeDasharray="3 4" />
          ))}

          {/* solid axes at the origin */}
          <line x1={0} y1={0} x2={0} y2={IH} stroke="#ffffff66" strokeWidth={1.25} />
          <line x1={0} y1={IH} x2={IW} y2={IH} stroke="#ffffff66" strokeWidth={1.25} />

          {/* y-axis labels (extremes + the two grade thresholds), on the left */}
          <text x={-10} y={y(100) + 5} textAnchor="end" fontSize={16} fill="#ffffffb3">100</text>
          <text x={-10} y={y(75) + 5} textAnchor="end" fontSize={13} fill="#ffffff99">75 Right</text>
          <text x={-10} y={y(60) + 5} textAnchor="end" fontSize={13} fill="#ffffff99">60 Meh</text>
          <text x={-10} y={y(yMin) + 5} textAnchor="end" fontSize={16} fill="#ffffffb3">{yMin}</text>
          {/* y-axis title */}
          <text transform={`translate(-66, ${IH / 2}) rotate(-90)`} textAnchor="middle"
            fontSize={14} fill="#ffffff80">Score</text>

          {/* the lines — each wrapped with a fat invisible hit path for easy clicking */}
          {drawn.map(({ source, points }) => {
            const st = STYLE[source] ?? FALLBACK_STYLE;
            const w = (st.width ?? 1.5) + (picked === source ? 1 : 0);
            return (
              <g key={source} onClick={() => toggle(source)} style={{ cursor: "pointer" }} opacity={dim(source)}>
                <LinePath data={points} x={(p) => x(p.lead)} y={(p) => y(p.value)}
                  stroke="transparent" strokeWidth={14} />
                <LinePath data={points} x={(p) => x(p.lead)} y={(p) => y(p.value)}
                  stroke={st.color} strokeWidth={w} strokeDasharray={st.dash} />
                {points.map((p) => (
                  <circle key={p.lead} cx={x(p.lead)} cy={y(p.value)} r={2.4} fill={st.color} />
                ))}
              </g>
            );
          })}

          {/* x-axis day labels */}
          {leads.map((l) => (
            <text key={l} x={x(l)} y={IH + 20} textAnchor={l === 0 ? "start" : "middle"}
              fontSize={16} fill="#ffffffb3">
              {l === 0 ? "Same day" : l}
            </text>
          ))}
          {/* x-axis title, spaced clear of the day labels */}
          <text x={IW / 2} y={IH + 46} textAnchor="middle" fontSize={14} fill="#ffffff80">
            Forecasted days out
          </text>
        </Group>
      </svg>

      {/* data-dependent claim — re-verify against leadtime_scores when editing
          ("single day-5 row" = raysweather lead-5 n; the n>=10 floor test fails
          loudly if it ever accumulates past the floor) */}
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
