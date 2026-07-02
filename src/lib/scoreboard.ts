import type { Scores } from "@/lib/types";
import { FORECASTERS } from "@/lib/forecasters";
import { HEADLINE_SOURCES, isProvisional } from "@/lib/gating";

const LABELS: Record<string, string> = {
  raysweather: "Ray's Weather", openmeteo: "Open-Meteo", apple_weather: "Apple Weather",
};

const label = (src: string) => FORECASTERS[src]?.label ?? LABELS[src] ?? src;
const avgOf = (t: { total_score: number; days: number }) =>
  t.days > 0 ? Math.round((t.total_score / t.days) * 10) / 10 : 0;

export interface ScoreboardRow { key: string; label: string; record: string; avg: number; days: number; }

export function scoreboardRows(scores: Scores | null): ScoreboardRow[] {
  if (!scores?.totals) return [];
  return Object.entries(scores.totals).map(([src, t]) => ({
    key: src,
    label: label(src),
    record: `${t!.right}W - ${t!.wrong}L - ${t!.meh}M`,
    avg: avgOf(t!),
    days: t!.days,
  }));
}

export interface OtherSourceRow {
  key: string; label: string; isFree: boolean;
  record: string; avg: number; days: number; provisional: boolean;
}

// "The rest of the field": every tracked source that isn't the Ray-vs-free
// headline. All are free / automated forecasters. Ordered by the FORECASTERS
// display order; each carries a provisional flag (under MIN_SCORED_DAYS).
export function otherSourcesRows(scores: Scores | null): OtherSourceRow[] {
  if (!scores?.totals) return [];
  const order = Object.keys(FORECASTERS);
  const rank = (k: string) => { const i = order.indexOf(k); return i === -1 ? order.length : i; };
  return Object.entries(scores.totals)
    .filter(([src]) => !HEADLINE_SOURCES.has(src))
    .map(([src, t]) => ({
      key: src,
      label: label(src),
      isFree: true,
      record: `${t!.right}W - ${t!.wrong}L - ${t!.meh}M`,
      avg: avgOf(t!),
      days: t!.days,
      provisional: isProvisional(t!.days),
    }))
    .sort((a, b) => rank(a.key) - rank(b.key));
}
