"use client";
import { useMemo } from "react";
import { ParentSize } from "@visx/responsive";
import { scaleLinear } from "@visx/scale";
import { LinePath } from "@visx/shape";
import { Group } from "@visx/group";
import { AxisLeft } from "@visx/axis";
import { GridRows } from "@visx/grid";
import { useTooltip, TooltipWithBounds } from "@visx/tooltip";
import { localPoint } from "@visx/event";
import type { TrendPoint } from "@/lib/homeStats";
import type { TooltipEntry } from "@/lib/trendTooltip";

const M = { top: 8, right: 12, bottom: 4, left: 28 };

function Chart({ width, height, points, tooltip }:
  { width: number; height: number; points: TrendPoint[]; tooltip: Record<string, TooltipEntry> }) {
  const iw = Math.max(0, width - M.left - M.right);
  const ih = Math.max(0, height - M.top - M.bottom);
  const x = useMemo(() => scaleLinear({ domain: [0, Math.max(1, points.length - 1)], range: [0, iw] }), [points.length, iw]);
  const y = useMemo(() => scaleLinear({ domain: [40, 100], range: [ih, 0], clamp: true }), [ih]);
  const { showTooltip, hideTooltip, tooltipData, tooltipLeft, tooltipTop } = useTooltip<TooltipEntry>();

  const onMove = (e: React.MouseEvent | React.TouchEvent) => {
    const pt = localPoint(e); if (!pt) return;
    const i = Math.round(x.invert(pt.x - M.left));
    const p = points[Math.min(points.length - 1, Math.max(0, i))];
    const t = p && tooltip[p.date];
    if (t) showTooltip({ tooltipData: t, tooltipLeft: M.left + x(i), tooltipTop: M.top });
  };

  return (
    <div style={{ position: "relative" }} onMouseLeave={hideTooltip}>
      <svg width={width} height={height} role="img" aria-label="Daily forecast accuracy: Open-Meteo (free) vs Ray's Weather (paid) over the tracked head-to-head window">
        <Group left={M.left} top={M.top}>
          <GridRows scale={y} width={iw} height={ih} tickValues={[60, 75]} stroke="var(--color-border, #ffffff22)" strokeDasharray="3 4" />
          <AxisLeft scale={y} numTicks={3} tickStroke="transparent" stroke="transparent" tickLabelProps={() => ({ fill: "#ffffff80", fontSize: 10, dx: -2 })} />
          <LinePath data={points} x={(_p, i) => x(i)} y={(p) => y(p.rays as number)} stroke="var(--orange)" strokeWidth={2} strokeDasharray="5 4" />
          <LinePath data={points.map((p, i) => ({ ...p, i })).filter((p) => p.free != null)} x={(p) => x(p.i)} y={(p) => y(p.free as number)} stroke="var(--green)" strokeWidth={2.4} />
          <rect width={iw} height={ih} fill="transparent" onMouseMove={onMove} onTouchMove={onMove} onTouchStart={onMove} />
        </Group>
      </svg>
      {tooltipData && (
        <TooltipWithBounds left={tooltipLeft} top={tooltipTop} style={{ position: "absolute", background: "white", color: "#26323d", padding: "8px 10px", borderRadius: 8, fontSize: 12, pointerEvents: "none" }}>
          <div style={{ fontWeight: 500 }}>{tooltipData.date}</div>
          <div>Open-Meteo {tooltipData.openmeteo ?? "—"} · Ray&apos;s {tooltipData.rays ?? "—"}</div>
          {tooltipData.actualLines[0] && <div style={{ color: "#5f6b75" }}>{tooltipData.actualLines.join(" · ")}</div>}
          {tooltipData.rayMisses.filter((m) => m.published && m.error != null).slice(0, 2).map((m) => (
            <div key={m.field} style={{ color: "#993c1d" }}>Ray&apos;s {m.label}: {String(m.predicted)} (±{m.error})</div>
          ))}
          {tooltipData.rayMisses.some((m) => m.field === "precip_amount" && !m.published) && (
            <div style={{ color: "#993c1d" }}>Ray&apos;s precip amount: not published</div>
          )}
        </TooltipWithBounds>
      )}
    </div>
  );
}

export default function TrendChartInteractive({ points, tooltip }:
  { points: TrendPoint[]; tooltip: Record<string, TooltipEntry> }) {
  return (
    <div className="h-[260px] w-full">
      <ParentSize>{({ width, height }) => width > 0 ? <Chart width={width} height={height} points={points} tooltip={tooltip} /> : null}</ParentSize>
      <table className="sr-only">
        <caption>Daily accuracy scores, Open-Meteo vs Ray&apos;s</caption>
        <thead><tr><th>Date</th><th>Open-Meteo</th><th>Ray&apos;s</th></tr></thead>
        <tbody>{points.map((p) => <tr key={p.date}><td>{p.date}</td><td>{p.free ?? ""}</td><td>{p.rays ?? ""}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
