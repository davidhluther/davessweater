import type { Scores } from "@/lib/types";

const LABELS: Record<string, string> = {
  raysweather: "Ray's Weather", openmeteo: "Open-Meteo", apple_weather: "Apple Weather",
};

export interface ScoreboardRow { label: string; record: string; avg: number; days: number; }

export function scoreboardRows(scores: Scores | null): ScoreboardRow[] {
  if (!scores?.totals) return [];
  return Object.entries(scores.totals).map(([src, t]) => ({
    label: LABELS[src] ?? src,
    record: `${t!.right}W - ${t!.wrong}L - ${t!.meh}M`,
    avg: t!.days > 0 ? Math.round((t!.total_score / t!.days) * 10) / 10 : 0,
    days: t!.days,
  }));
}
