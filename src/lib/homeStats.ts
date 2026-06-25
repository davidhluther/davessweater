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
  // Tracking-period stats (entries where raysweather is present)
  trackingDays: number; trackingSources: SourceStat[];
  trackingRays: SourceStat | null; trackingBestFree: SourceStat | null;
  trackingPointGap: number; trackingFreeNeverWrong: boolean; trackingRaysWrong: number;
  // Open-Meteo full-record (474-day) stat
  openmeteoFull: SourceStat | null;
}

function toStat(key: SrcKey, t: SourceTotals): SourceStat {
  return {
    key, label: LABELS[key], isFree: IS_FREE[key],
    avg: t.days > 0 ? round1(t.total_score / t.days) : 0,
    right: t.right, wrong: t.wrong, meh: t.meh, days: t.days,
    record: `${t.right}–${t.wrong}–${t.meh}`,
  };
}

function grade(score: number): "right" | "meh" | "wrong" {
  if (score >= 75) return "right";
  if (score >= 60) return "meh";
  return "wrong";
}

function buildTrackingStat(key: SrcKey, scores: number[]): SourceStat {
  const right = scores.filter((s) => grade(s) === "right").length;
  const meh = scores.filter((s) => grade(s) === "meh").length;
  const wrong = scores.filter((s) => grade(s) === "wrong").length;
  const avg = scores.length > 0 ? round1(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  return {
    key, label: LABELS[key], isFree: IS_FREE[key],
    avg, right, wrong, meh, days: scores.length,
    record: `${right}–${wrong}–${meh}`,
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

  // Tracking-period: entries where raysweather is a number
  const entries = scores?.entries ?? [];
  const trackingEntries = entries.filter((e) => typeof e.raysweather === "number");
  const trackingDays = trackingEntries.length;

  const TRACKING_ORDER: SrcKey[] = ["openmeteo", "apple_weather", "raysweather"];
  const trackingScoreMap: Record<SrcKey, number[]> = { openmeteo: [], apple_weather: [], raysweather: [] };
  for (const e of trackingEntries) {
    for (const k of TRACKING_ORDER) {
      if (typeof (e as Record<string, unknown>)[k] === "number") {
        trackingScoreMap[k].push((e as Record<string, unknown>)[k] as number);
      }
    }
  }
  const trackingSources = TRACKING_ORDER
    .filter((k) => trackingScoreMap[k].length > 0)
    .map((k) => buildTrackingStat(k, trackingScoreMap[k]));
  const trackingRays = trackingSources.find((s) => !s.isFree) ?? null;
  const trackingFrees = trackingSources.filter((s) => s.isFree);
  const trackingBestFree = trackingFrees.length
    ? trackingFrees.reduce((a, b) => (b.avg > a.avg ? b : a))
    : null;
  const trackingPointGap = trackingBestFree && trackingRays
    ? round1(trackingBestFree.avg - trackingRays.avg)
    : 0;
  const trackingFreeNeverWrong = trackingFrees.every((s) => s.wrong === 0);
  const trackingRaysWrong = trackingRays?.wrong ?? 0;

  // Open-Meteo full record (from totals — includes backfilled 474-day record)
  const openmeteoFull = totals.openmeteo ? toStat("openmeteo", totals.openmeteo as SourceTotals) : null;

  return {
    trackedDays, sources, rays, bestFree, pointGap, raysWrongDays: rays?.wrong ?? 0,
    trackingDays, trackingSources, trackingRays, trackingBestFree,
    trackingPointGap, trackingFreeNeverWrong, trackingRaysWrong,
    openmeteoFull,
  };
}

// ---------------------------------------------------------------------------
// trendSeries
// ---------------------------------------------------------------------------

export interface TrendPoint { date: string; free: number | null; rays: number | null; }

const num = (v: unknown): number | null => (typeof v === "number" && isFinite(v) ? v : null);

// Scoped to the head-to-head tracking window — dates where Ray's has a score — so the chart
// reads as a true free-vs-Ray's comparison. (Open-Meteo's backfilled record runs ~474 days,
// far past Ray's 109; plotting all of it would strand Ray's line in the recent third and read
// like his data "cuts off." His full archived record is contextualized in the hero copy.)
export function trendSeries(scores: Scores | null): TrendPoint[] {
  const entries = scores?.entries ?? [];
  return entries
    .map((e) => ({ date: String(e.date ?? ""), free: num(e.openmeteo), rays: num(e.raysweather) }))
    .filter((p) => p.date && p.rays !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
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

export interface WhyStats {
  trackedDays: number;
  freeLabel: string;
  freeAvg: number;
  raysAvg: number;
  gap: number;
  raysPrecipDays: number;
  raysPrecipProvided: number;
}

export function whyStats(scores: Scores | null): WhyStats {
  const h = heroStats(scores);
  const raysPrecip = scores?.coverage?.raysweather?.precip_amount;
  return {
    trackedDays: h.trackingDays,
    freeLabel: h.trackingBestFree?.label ?? "Open-Meteo",
    freeAvg: h.trackingBestFree?.avg ?? 0,
    raysAvg: h.trackingRays?.avg ?? 0,
    gap: h.trackingPointGap,
    raysPrecipDays: raysPrecip?.days ?? h.trackingRays?.days ?? 0,
    raysPrecipProvided: raysPrecip?.provided ?? 0,
  };
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
