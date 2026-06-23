import type { Scores, SourceTotals, Comparison, Actuals } from "@/lib/types";

type SrcKey = "openmeteo" | "apple_weather" | "raysweather";
const ORDER: SrcKey[] = ["openmeteo", "apple_weather", "raysweather"];
const LABELS: Record<SrcKey, string> = {
  openmeteo: "Open-Meteo", apple_weather: "Apple Weather", raysweather: "Ray's Weather",
};
const IS_FREE: Record<SrcKey, boolean> = { openmeteo: true, apple_weather: true, raysweather: false };

const round1 = (n: number) => Math.round(n * 10) / 10;

export interface SourceStat {
  key: SrcKey; label: string; isFree: boolean;
  avg: number; right: number; wrong: number; meh: number; days: number; record: string;
}
export interface HeroStats {
  trackedDays: number; sources: SourceStat[];
  rays: SourceStat | null; bestFree: SourceStat | null;
  pointGap: number; raysWrongDays: number;
}

function toStat(key: SrcKey, t: SourceTotals): SourceStat {
  return {
    key, label: LABELS[key], isFree: IS_FREE[key],
    avg: t.days > 0 ? round1(t.total_score / t.days) : 0,
    right: t.right, wrong: t.wrong, meh: t.meh, days: t.days,
    record: `${t.right}–${t.wrong}–${t.meh}`,
  };
}

export function heroStats(scores: Scores | null): HeroStats {
  const totals = scores?.totals ?? {};
  const sources = ORDER.filter((k) => totals[k]).map((k) => toStat(k, totals[k] as SourceTotals));
  const rays = sources.find((s) => !s.isFree) ?? null;
  const frees = sources.filter((s) => s.isFree);
  const bestFree = frees.length ? frees.reduce((a, b) => (b.avg > a.avg ? b : a)) : null;
  const trackedDays = Math.max(0, ...sources.map((s) => s.days));
  const pointGap = bestFree && rays ? round1(bestFree.avg - rays.avg) : 0;
  // raysWrongDays = days Ray's scored under 60 (graded "Wrong"), from totals.wrong
  return { trackedDays, sources, rays, bestFree, pointGap, raysWrongDays: rays?.wrong ?? 0 };
}

// ---------------------------------------------------------------------------
// trendSeries + trendChartGeometry
// ---------------------------------------------------------------------------

export interface TrendPoint { date: string; free: number | null; rays: number | null; }

const num = (v: unknown): number | null => (typeof v === "number" && isFinite(v) ? v : null);

export function trendSeries(scores: Scores | null): TrendPoint[] {
  const entries = scores?.entries ?? [];
  return entries
    .map((e) => ({ date: String(e.date ?? ""), free: num(e.openmeteo), rays: num(e.raysweather) }))
    .filter((p) => p.date)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface TrendGeometry { free: string; rays: string; width: number; height: number; }

export function trendChartGeometry(
  points: TrendPoint[], width = 600, height = 120, min = 40, max = 100,
): TrendGeometry {
  const span = Math.max(1, points.length - 1);
  const x = (i: number) => Math.round((i / span) * width);
  const y = (v: number) => Math.round((1 - (Math.min(max, Math.max(min, v)) - min) / (max - min)) * height);
  const line = (sel: (p: TrendPoint) => number | null) =>
    points
      .map((p, i) => ({ i, v: sel(p) }))
      .filter((d) => d.v != null)
      .map((d) => `${x(d.i)},${y(d.v as number)}`)
      .join(" ");
  return { free: line((p) => p.free), rays: line((p) => p.rays), width, height };
}

// ---------------------------------------------------------------------------
// headToHead
// ---------------------------------------------------------------------------

export interface HeadToHead { date: string; dave: number | null; rays: number | null; actualLines: string[]; }

export function actualLines(a: Actuals | undefined): string[] {
  if (!a) return [];
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

export function headToHead(comp: Comparison | null): HeadToHead | null {
  if (!comp) return null;
  return {
    date: comp.date,
    dave: comp.sources?.openmeteo?.score?.score ?? null,
    rays: comp.sources?.raysweather?.score?.score ?? null,
    actualLines: actualLines(comp.actuals),
  };
}
