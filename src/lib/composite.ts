import type { LatestForecasts } from "@/lib/types";

// The consensus excludes Ray's (the forecaster we grade against) and the Apple
// slot (it mirrors the Open-Meteo fallback, so including it would double-weight
// Open-Meteo). What's left is the spread of independent automated forecasters.
const EXCLUDE = new Set(["raysweather", "apple_weather"]);

const PRECIP_LABEL: Record<string, string> = {
  rain: "Rain likely",
  snow: "Snow",
  mixed: "Wintry mix",
  none: "No precip",
};

export interface Composite {
  date: string;
  dateLabel: string;
  high: number;
  low: number;
  precipLabel: string;
  count: number;
  sources: string[];
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function compositeForecast(latest: LatestForecasts | null): Composite | null {
  if (!latest?.sources) return null;
  const entries = Object.entries(latest.sources).filter(([k]) => !EXCLUDE.has(k));
  // A forecaster contributes to the index when it published a high for the day.
  const contributing = entries.filter(([, v]) => typeof v.high_f === "number");
  const highs = contributing.map(([, v]) => v.high_f as number);
  const lows = entries.map(([, v]) => v.low_f).filter((n): n is number => typeof n === "number");
  if (highs.length < 2 || lows.length < 2) return null;

  // Majority precip type across the contributing forecasters.
  const counts: Record<string, number> = {};
  for (const [, v] of entries) {
    if (v.precip_type) counts[v.precip_type] = (counts[v.precip_type] ?? 0) + 1;
  }
  const precip = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "none";

  const d = new Date(latest.date + "T12:00:00");
  const dateLabel = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return {
    date: latest.date,
    dateLabel,
    high: Math.round(mean(highs)),
    low: Math.round(mean(lows)),
    precipLabel: PRECIP_LABEL[precip] ?? precip,
    count: highs.length,
    sources: contributing.map(([k]) => k),
  };
}
