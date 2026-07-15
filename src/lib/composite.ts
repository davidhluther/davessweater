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
  /** Raw majority precip key ("rain" | "snow" | "mixed" | "none") — for logic like the hero backdrop. */
  precip: string;
  /** Human label for the raw key — for display. */
  precipLabel: string;
  count: number;
  sources: string[];
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

// The DSI's precip type from its contributing members' precip_type values, via
// the credible-minority rule. Kept byte-for-byte in sync with
// compare.py:_composite_precip_type — change both together.
export function compositePrecipType(types: (string | null | undefined)[]): string {
  const callers = types.filter((t) => t === "rain" || t === "snow" || t === "mixed");
  const needed = Math.max(2, Math.round(0.25 * types.length));
  if (callers.length < needed) return "none";
  const r = callers.filter((t) => t === "rain").length;
  const s = callers.filter((t) => t === "snow").length;
  const m = callers.filter((t) => t === "mixed").length;
  if (m > 0 || (r > 0 && s > 0)) return "mixed";
  return r > 0 ? "rain" : "snow";
}

export function compositeForecast(latest: LatestForecasts | null): Composite | null {
  if (!latest?.sources) return null;
  const entries = Object.entries(latest.sources).filter(([k]) => !EXCLUDE.has(k));
  // A forecaster contributes to the index when it published a high for the day.
  const contributing = entries.filter(([, v]) => typeof v.high_f === "number");
  const highs = contributing.map(([, v]) => v.high_f as number);
  const lows = entries.map(([, v]) => v.low_f).filter((n): n is number => typeof n === "number");
  if (highs.length < 2 || lows.length < 2) return null;

  // Precip type via the "credible minority" rule — kept in sync with
  // compare.py:_composite_precip_type (see that docstring). Plain majority-vote
  // lets a dry majority veto a minority that correctly called the rain; instead,
  // if at least a quarter of contributors (floored at 2) forecast precip, the
  // DSI forecasts precip, with rain/snow following the majority among those
  // callers and any real rain/snow split reading "mixed".
  const precip = compositePrecipType(contributing.map(([, v]) => v.precip_type));

  const d = new Date(latest.date + "T12:00:00");
  const dateLabel = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return {
    date: latest.date,
    dateLabel,
    high: Math.round(mean(highs)),
    low: Math.round(mean(lows)),
    precip,
    precipLabel: PRECIP_LABEL[precip] ?? precip,
    count: highs.length,
    sources: contributing.map(([k]) => k),
  };
}
