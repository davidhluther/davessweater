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
  days: { date: string; sources: Record<string, ForecastDisplay & { precip_prob?: number }> }[];
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
  /** 0–5 sweater verdict from the composite high. */
  sweaters: number;
  /** Number of forecasters contributing to the day's consensus. */
  count: number;
}

export function stripDays(f5: Forecast5Day | null, opts?: { max?: number }): StripDay[] {
  if (!f5?.days) return [];
  const max = opts?.max ?? 6;
  const out: StripDay[] = [];
  for (const day of f5.days) {
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
      // A forecast day has no "current temp" to blend, so the effective temp
      // IS the high (effectiveTemp(h, h) === h) — the published bands applied
      // straight to the consensus high.
      sweaters: sweaterFromEffective(c.high).score,
      count: c.count,
    });
  }
  return out;
}
