import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ForecastDisplay } from "@/lib/types";
import { compositeForecast } from "@/lib/composite";
import { sweaterFromEffective } from "@/lib/sweater";
import { fmtShortDate } from "@/lib/dates";

const DATA = join(process.cwd(), "data");

// Shape mirrors compare.py:build_forecast_5day()'s data/forecast_5day.json
// artifact: one entry per upcoming day, each carrying the same per-source
// display rows as latest_forecasts.json (plus an optional precip_prob where
// the provider publishes one). Each days[] entry is structurally a
// LatestForecasts, so it feeds compositeForecast() directly.
export interface Forecast5Day {
  generated_at: string;
  location: string;
  days: {
    date: string;
    sky?: string | null;
    sources: Record<string, ForecastDisplay & { precip_prob?: number }>;
  }[];
}

export async function getForecast5Day(): Promise<Forecast5Day | null> {
  try { return JSON.parse(await readFile(join(DATA, "forecast_5day.json"), "utf8")) as Forecast5Day; }
  catch { return null; }
}

// One card of the consumer strip. Everything here is display-ready: the
// consensus numbers come from the same compositeForecast() that powers the
// Dave's Sweater Index, and the sweater verdict is the site's published band
// applied to that consensus high.
export interface StripDay {
  date: string;
  /** Short weekday, e.g. "Fri". */
  weekday: string;
  /** Short date, e.g. "Jul 10" — the compact form sanctioned for tight data UI. */
  dayLabel: string;
  high: number;
  low: number;
  /** Raw majority precip key ("rain" | "snow" | "mixed" | "none"). */
  precip: string;
  /** Human label for the raw key. */
  precipLabel: string;
  /** Highest precip chance among the contributing free forecasts, when any publishes one. */
  precipProb?: number;
  /** Short character line leading with sky + temp, qualifying precip (e.g. "Mostly sunny, warm"). */
  summary: string;
  /** Median wind across contributing sources, e.g. "12 mph". Omitted when no source publishes one. */
  wind?: string;
  /** How tightly the sources' highs cluster that day — "high" | "medium" | "low". */
  confidence: "high" | "medium" | "low";
  /** 0–5 sweater verdict from the composite high. */
  sweaters: number;
  /** Number of forecasters contributing to the day's consensus. */
  count: number;
}

function tempWord(h: number) {
  return h >= 88 ? "hot" : h >= 78 ? "warm" : h >= 68 ? "mild" : h >= 58 ? "cool" : h >= 48 ? "chilly" : "cold";
}
function skyWord(sky?: string | null) {                 // dry-day sky word
  if (!sky) return null;
  if (sky === "clear") return "Sunny";
  if (sky === "fog") return "Foggy";
  return "Cloudy";                                       // cloudy/rain/snow/storm all read "Cloudy" as a sky word
}
function precipNoun(precip: string) {
  return precip === "snow" ? "snow" : precip === "mixed" ? "wintry mix" : "showers";
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
function summarize(sky: string | null | undefined, high: number, precip: string, precipProb?: number): string {
  const temp = tempWord(high);
  if (precip === "none" || precipProb == null) return `${skyWord(sky) ?? "Dry"}, ${temp}`;
  const noun = precipNoun(precip);
  if (precipProb >= 65) return `${cap(noun)} likely, ${temp}`;
  if (precipProb < 35 && sky === "clear") return `Mostly sunny, slight chance of ${noun}`;
  const qual = precipProb < 35 ? "slight chance of" : "a chance of";
  return `${cap(qual)} ${noun}, ${temp}`;
}
function medianWind(sources: Record<string, { wind?: string | null }>, keys: string[]): string | undefined {
  const nums = keys.map((k) => sources[k]?.wind).map((w) => (typeof w === "string" ? parseInt(w, 10) : NaN))
    .filter((n) => Number.isFinite(n)) as number[];
  if (!nums.length) return undefined;
  nums.sort((a, b) => a - b);
  return `${nums[Math.floor(nums.length / 2)]} mph`;
}
function confidenceTier(sources: Record<string, { high_f?: number | null }>, keys: string[]): "high" | "medium" | "low" {
  const highs = keys.map((k) => sources[k]?.high_f).filter((n): n is number => typeof n === "number");
  if (highs.length < 2) return "medium";
  const spread = Math.max(...highs) - Math.min(...highs);
  return spread <= 3 ? "high" : spread <= 6 ? "medium" : "low";
}

export function stripDays(f5: Forecast5Day | null, opts?: { max?: number; today?: string }): StripDay[] {
  // Array.isArray closes the one throw path: a malformed data commit (days as
  // a non-array) would otherwise crash the production build — Vercel builds
  // don't run vitest, so this must degrade to an empty strip, not a throw.
  if (!f5 || !Array.isArray(f5.days)) return [];
  const max = opts?.max ?? 5;
  // The artifact is written by the morning pipeline, so when the site builds
  // from data captured yesterday its leading day is already in the past. Skip
  // days before today (America/New_York, the site's clock) so the first card
  // is always today. Accepted caveat: this fixes artifact lag at build time
  // only — the midnight-to-morning-rebuild staleness window is inherent to
  // the static daily-build architecture, and every surface shares it.
  const today = opts?.today
    ?? new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }); // en-CA = YYYY-MM-DD
  const out: StripDay[] = [];
  for (const day of f5.days) {
    // Before the cap check: a dropped past day must not consume a cap slot.
    if (day.date < today) continue;
    if (out.length >= max) break;
    // Days where fewer than 2 free sources contribute have no consensus — drop
    // them rather than render a one-source "composite".
    const c = compositeForecast(day);
    if (!c) continue;
    // Chance shown is the HIGHEST precip_prob among the day's contributing
    // free forecasts (a conservative display choice — "up to a 60% chance" —
    // not part of scoring). Only contributing sources get a say, so Ray's and
    // the Apple mirror can't leak a probability in. Omitted entirely when no
    // contributor publishes one.
    const probs = c.sources
      .map((k) => day.sources[k]?.precip_prob)
      .filter((p): p is number => typeof p === "number");
    const d = new Date(day.date + "T12:00:00"); // noon anchor: see src/lib/dates.ts
    out.push({
      date: day.date,
      weekday: d.toLocaleDateString("en-US", { weekday: "short" }),
      dayLabel: fmtShortDate(day.date),
      high: c.high,
      low: c.low,
      precip: c.precip,
      precipLabel: c.precipLabel,
      ...(probs.length ? { precipProb: Math.max(...probs) } : {}),
      summary: summarize(day.sky, c.high, c.precip, probs.length ? Math.max(...probs) : undefined),
      ...(medianWind(day.sources, c.sources) ? { wind: medianWind(day.sources, c.sources) } : {}),
      confidence: confidenceTier(day.sources, c.sources),
      // A forecast day has no "current temp" to blend, so the effective temp
      // IS the high (effectiveTemp(h, h) === h) — the published bands applied
      // straight to the consensus high.
      sweaters: sweaterFromEffective(c.high).score,
      count: c.count,
    });
  }
  return out;
}
