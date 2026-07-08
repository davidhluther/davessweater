"use client";
import { useMemo, useState } from "react";
import { ParentSize } from "@visx/responsive";
import { scaleLinear } from "@visx/scale";
import { LinePath, Area } from "@visx/shape";
import { Group } from "@visx/group";
import { AxisLeft } from "@visx/axis";
import { GridRows } from "@visx/grid";
import { useTooltip, TooltipWithBounds } from "@visx/tooltip";
import { localPoint } from "@visx/event";
import type { TrendPoint } from "@/lib/homeStats";
import type { TooltipEntry } from "@/lib/trendTooltip";
import { fmtShortDate } from "@/lib/dates";

const M = { top: 8, right: 12, bottom: 4, left: 34 };
const RAY_GRAY = "#94a3b8"; /* slate-400: Ray's in data contexts */

type Mode = "avg" | "daily";
interface DispPoint { date: string; i: number; free: number | null; rays: number | null; }

// Trailing 7-day mean over the non-null values in the window.
function rolling(vals: (number | null)[], w = 7): (number | null)[] {
  return vals.map((_, i) => {
    const win = vals.slice(Math.max(0, i - w + 1), i + 1).filter((v): v is number => v != null);
    return win.length ? win.reduce((a, b) => a + b, 0) / win.length : null;
  });
}

function Chart({ width, height, disp, tooltip }:
  { width: number; height: number; disp: DispPoint[]; tooltip: Record<string, TooltipEntry> }) {
  const iw = Math.max(0, width - M.left - M.right);
  const ih = Math.max(0, height - M.top - M.bottom);
  const x = useMemo(() => scaleLinear({ domain: [0, Math.max(1, disp.length - 1)], range: [0, iw] }), [disp.length, iw]);
  const y = useMemo(() => scaleLinear({ domain: [40, 100], range: [ih, 0], clamp: true }), [ih]);
  const { showTooltip, hideTooltip, tooltipData, tooltipLeft, tooltipTop } = useTooltip<TooltipEntry>();

  const onMove = (e: React.MouseEvent | React.TouchEvent) => {
    const pt = localPoint(e); if (!pt) return;
    const i = Math.round(x.invert(pt.x - M.left));
    const p = disp[Math.min(disp.length - 1, Math.max(0, i))];
    const t = p && tooltip[p.date];
    if (t) showTooltip({ tooltipData: t, tooltipLeft: M.left + x(i), tooltipTop: M.top });
  };

  const both = disp.filter((p) => p.free != null && p.rays != null);

  return (
    <div style={{ position: "relative" }} onMouseLeave={hideTooltip}>
      <svg width={width} height={height} role="img" aria-label="Forecast accuracy, Open-Meteo vs Ray's Weather over the tracked head-to-head window; the shaded region is the gap between them">
        <Group left={M.left} top={M.top}>
          <GridRows scale={y} width={iw} height={ih} tickValues={[60, 75]} stroke="var(--color-border, #ffffff22)" strokeDasharray="3 4" />
          <AxisLeft scale={y} numTicks={3} tickStroke="transparent" stroke="transparent" tickLabelProps={() => ({ fill: "#ffffffb3", fontSize: 12, dx: -2 })} />
          <text x={iw - 4} y={y(75) - 5} textAnchor="end" fontSize={10} fill="#ffffff80">graded Right ≥ 75</text>
          <text x={iw - 4} y={y(60) - 5} textAnchor="end" fontSize={10} fill="#ffffff80">Meh ≥ 60</text>
          <Area
            data={both}
            x={(p) => x(p.i)}
            y0={(p) => y(p.rays as number)}
            y1={(p) => y(p.free as number)}
            fill="rgba(110, 231, 183, 0.16)"
          />
          <LinePath data={disp.filter((p) => p.rays != null)} x={(p) => x(p.i)} y={(p) => y(p.rays as number)} stroke={RAY_GRAY} strokeWidth={2} strokeDasharray="5 4" />
          <LinePath data={disp.filter((p) => p.free != null)} x={(p) => x(p.i)} y={(p) => y(p.free as number)} stroke="var(--green)" strokeWidth={2.4} />
          <rect width={iw} height={ih} fill="transparent" onMouseMove={onMove} onTouchMove={onMove} onTouchStart={onMove} />
        </Group>
      </svg>
      {tooltipData && (
        <TooltipWithBounds left={tooltipLeft} top={tooltipTop} style={{ position: "absolute", maxWidth: 200, background: "white", color: "#26323d", padding: "6px 9px", borderRadius: 8, fontSize: 12, lineHeight: 1.35, pointerEvents: "none" }}>
          <div><span style={{ fontWeight: 500 }}>{fmtShortDate(tooltipData.date)}</span> | OM {tooltipData.openmeteo ?? "—"} | Ray&apos;s {tooltipData.rays ?? "—"}</div>
          {tooltipData.actualLines[0] && <div style={{ color: "#5f6b75" }}>{tooltipData.actualLines.join(" | ")}</div>}
        </TooltipWithBounds>
      )}
    </div>
  );
}

export default function TrendChartInteractive({ points, tooltip }:
  { points: TrendPoint[]; tooltip: Record<string, TooltipEntry> }) {
  const [mode, setMode] = useState<Mode>("avg");
  const disp = useMemo<DispPoint[]>(() => {
    const rays = points.map((p) => p.rays ?? null);
    const free = points.map((p) => p.free ?? null);
    const r = mode === "avg" ? rolling(rays) : rays;
    const f = mode === "avg" ? rolling(free) : free;
    return points.map((p, i) => ({ date: p.date, i, rays: r[i], free: f[i] }));
  }, [points, mode]);

  const btn = (m: Mode, label: string) => (
    <button type="button" onClick={() => setMode(m)} aria-pressed={mode === m}
      className={`px-2.5 py-1 transition-colors ${mode === m ? "bg-white/15 text-white" : "text-white/60 hover:text-white"}`}>
      {label}
    </button>
  );

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[0.7rem] text-white/70">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-[3px] w-4 rounded bg-green" /> Open-Meteo (free)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block w-4 border-t-2 border-dashed border-slate-400" /> Ray&apos;s Weather
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-2.5 w-4 rounded-sm bg-emerald-300/25" /> The gap
          </span>
        </div>
        <div role="group" aria-label="Chart smoothing" className="flex overflow-hidden rounded-md border border-white/15">
          {btn("avg", "7-day average")}
          {btn("daily", "Daily")}
        </div>
      </div>
      <div className="h-[260px] w-full">
        <ParentSize>{({ width, height }) => width > 0 ? <Chart width={width} height={height} disp={disp} tooltip={tooltip} /> : null}</ParentSize>
      </div>
      <div className="sr-only">
        <table>
          <caption>Daily accuracy scores, Open-Meteo vs Ray&apos;s</caption>
          <thead><tr><th>Date</th><th>Open-Meteo</th><th>Ray&apos;s</th></tr></thead>
          <tbody>{points.map((p) => <tr key={p.date}><td>{p.date}</td><td>{p.free ?? ""}</td><td>{p.rays ?? ""}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
