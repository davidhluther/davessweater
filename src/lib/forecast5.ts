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
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Mountain wind is a real local signal, so name it when it's stiff enough to
// feel. Null below the threshold keeps calm days quiet.
function windWord(mph?: number): string | null {
  if (mph == null || !Number.isFinite(mph)) return null;
  return mph >= 25 ? "windy" : mph >= 15 ? "breezy" : null;
}

// Dry-day sky lead. Open-Meteo's category (capture_openmeteo.weather_category)
// is the only per-day sky we get: "clear" spans WMO clear+mainly-clear,
// "cloudy" spans partly-cloudy+overcast. `mentionsPrecip` softens "Sunny" to
// "Mostly sunny" when a slight chance still rides along.
function drySkyLead(sky: string | null | undefined, mentionsPrecip: boolean): string {
  if (sky === "clear") return mentionsPrecip ? "Mostly sunny" : "Sunny";
  if (sky === "cloudy") return "Partly cloudy";
  if (sky === "fog") return "Morning fog";
  if (!sky) return "Dry";
  return "Mostly cloudy"; // a rain/drizzle/storm/snow sky but a dry-odds day
}

const precipNoun = (precip: string) =>
  precip === "snow" ? "snow" : precip === "mixed" ? "wintry mix" : "showers";

// Wet-day precip clause. Likelihood word is driven by the day's max chance;
// the noun leans on the sky category so storms and drizzle don't flatten into
// a generic "showers". This is what breaks a stormy week out of five identical
// "chance of showers" lines.
function wetClause(sky: string | null | undefined, precip: string, prob: number): string {
  if (sky === "drizzle") return prob >= 65 ? "Drizzle likely" : "Patchy drizzle";
  if (sky === "storm") return prob >= 65 ? "Thunderstorms likely" : prob >= 40 ? "Scattered storms" : "A stray storm";
  if (precip === "mixed") return prob >= 65 ? "Wintry mix likely" : "A wintry mix at times";
  const noun = precipNoun(precip);
  if (prob >= 65) return `${cap(noun)} likely`;
  if (prob >= 40) return `Scattered ${noun}`;
  return `A few ${noun}`;
}

// A day reads "wet" only at/above this chance; a 15–24% chance still surfaces,
// but as a slight-chance aside on an otherwise fair-sky lead.
const WET_MIN = 25;
const SLIGHT_MIN = 15;

function summarize(
  sky: string | null | undefined, high: number, precip: string,
  precipProb?: number, windMph?: number,
): string {
  const wind = windWord(windMph);
  const tail = wind ? `, ${tempWord(high)}, ${wind}` : `, ${tempWord(high)}`;
  const wet = precip !== "none" && precipProb != null && precipProb >= WET_MIN;
  if (wet) return `${wetClause(sky, precip, precipProb!)}${tail}`;
  // Dry-ish: fair-sky lead, with a slight-chance aside when a low chance lingers.
  const slight = precip !== "none" && precipProb != null && precipProb >= SLIGHT_MIN;
  const lead = drySkyLead(sky, slight);
  return slight ? `${lead}${tail}, slight chance of ${precipNoun(precip)}` : `${lead}${tail}`;
}

function medianWindMph(sources: Record<string, { wind?: string | null }>, keys: string[]): number | undefined {
  const nums = keys.map((k) => sources[k]?.wind).map((w) => (typeof w === "string" ? parseInt(w, 10) : NaN))
    .filter((n) => Number.isFinite(n)) as number[];
  if (!nums.length) return undefined;
  nums.sort((a, b) => a - b);
  return nums[Math.floor(nums.length / 2)];
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
    const maxProb = probs.length ? Math.max(...probs) : undefined;
    const windMph = medianWindMph(day.sources, c.sources);
    out.push({
      date: day.date,
      weekday: d.toLocaleDateString("en-US", { weekday: "short" }),
      dayLabel: fmtShortDate(day.date),
      high: c.high,
      low: c.low,
      precip: c.precip,
      precipLabel: c.precipLabel,
      ...(maxProb != null ? { precipProb: maxProb } : {}),
      summary: summarize(day.sky, c.high, c.precip, maxProb, windMph),
      ...(windMph != null ? { wind: `${windMph} mph` } : {}),
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
