import type { LatestForecasts } from "@/lib/types";

// The consensus excludes Ray's (the forecaster we grade against) and the Apple
// slot (it mirrors the Open-Meteo fallback, so including it would double-weight
// Open-Meteo). What's left is the spread of independent automated forecasters.
// raysweather is the graded forecaster; apple_weather mirrors the Open-Meteo
// fallback (double-weighting it). "composite" is the DSI's own row — now emitted
// into latest_forecasts.json for the "what they're predicting" table — and must
// never feed back into itself.
const EXCLUDE = new Set(["raysweather", "apple_weather", "composite"]);

const PRECIP_LABEL: Record<string, string> = {
  rain: "Rain likely",
  snow: "Snow",
  mixed: "Wintry mix",
  none: "No precip",
};

// Same labels with the likelihood word taken out, for lines that print the
// actual chance beside them. The type call (the credible-minority rule below)
// and the chance (a median across a different subset of sources) are separate
// quantities and CAN legitimately disagree — two of eight sources forecasting a
// trace of rain reads "rain" while the median chance sits at 9%. That's real
// signal, but "Rain likely | 9% chance" is a sentence arguing with itself, and
// the whole site rests on not doing that. When we can print the number, the
// word goes.
const PRECIP_LABEL_WITH_CHANCE: Record<string, string> = {
  ...PRECIP_LABEL,
  rain: "Rain",
};

/** The precip label to print, given whether a chance is printed beside it. */
export function precipLabelFor(precip: string, withChance: boolean): string {
  const table = withChance ? PRECIP_LABEL_WITH_CHANCE : PRECIP_LABEL;
  return table[precip] ?? precip;
}

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
  /** Consensus chance of precip (%), when any contributing forecaster publishes one. */
  precipProb?: number;
  /** How many contributing forecasters published a chance (≤ count). */
  precipProbCount?: number;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * Whether a consensus chance is worth printing beside the precip label. A flat
 * 0% next to "No precip" says the same thing twice; anything above it is news —
 * "No precip | 8% chance" is a real forecast where a bare "No precip" was the
 * whole reason the towns looked thin.
 */
export function showsChance(pct?: number | null): pct is number {
  return typeof pct === "number" && pct > 0;
}

/** The day's consensus chance of precip, and how many forecasters said so. */
export interface PrecipChance {
  /** Consensus chance, integer percent 0–100. */
  pct: number;
  /** How many contributing forecasters published a chance. */
  count: number;
}

// The chance we publish is the MEDIAN of the contributing forecasters that
// publish one — not the max the site used through 2026-07-27. Two reasons:
//
//   1. Back when Open-Meteo was the only source emitting a probability, "max
//      across contributors" was really just "whatever Open-Meteo said". With
//      six sources reporting it becomes the most alarmist forecast in the room,
//      and it ratchets up every time we add a source — the published number
//      would drift for reasons that have nothing to do with the weather.
//   2. The sources do not define the quantity identically (NWS publishes a
//      period PoP; WeatherAPI a daily chance of rain; OpenWeatherMap a per-3h
//      `pop` we reduce with a max). A mean lets one definitional outlier drag
//      the number; a median just steps over it. Wind is already medianed for
//      the same reason (medianWindMph in src/lib/forecast5.ts).
//
// Even counts average the two middle values rather than taking the upper one,
// so a two-source day sits between its forecasts instead of quietly preferring
// the higher — which on n=2 would be the max all over again.
export function precipChance(probs: (number | null | undefined)[]): PrecipChance | null {
  const xs = probs
    .filter((p): p is number => typeof p === "number" && Number.isFinite(p))
    .map((p) => Math.min(100, Math.max(0, p)))
    .sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = Math.floor(xs.length / 2);
  const med = xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
  return { pct: Math.round(med), count: xs.length };
}

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

  // Only contributing sources get a say, so Ray's (the forecaster we grade) and
  // the Apple mirror can never leak a chance into our own number.
  const chance = precipChance(contributing.map(([, v]) => v.precip_prob));

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
    ...(chance ? { precipProb: chance.pct, precipProbCount: chance.count } : {}),
  };
}
