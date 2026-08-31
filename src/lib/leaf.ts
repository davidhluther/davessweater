// Reads the committed fall-color predictions the Python model writes
// (scripts/predict_leaf.py -> data/leaf/predictions.json). Same read-the-repo
// pattern as roads.ts and towns.ts: the pipeline commits JSON, the site reads it
// at build time, nothing is fetched at request time.
//
// The model itself is documented in docs/leaf-model.md. The short version, and
// the only part a reader needs to check our arithmetic: peak color reaches about
// 5,000 ft in the first week of October, and the front descends roughly 6.5 days
// per 1,000 ft as it drops. A September temperature anomaly nudges that by up to
// a week in either direction, and is deliberately absent until September data
// actually exists -- `basis` on every record says which of those two it is.
//
// This module is the single reader for that file. The /leaf page, the town
// pages, and anything downstream (the tourism busy-ness up-weight) all come
// through here rather than each parsing the JSON their own way.

import { readFile } from "node:fs/promises";
import { join } from "node:path";

const DATA = join(process.cwd(), "data");

export interface LeafComponents {
  reference_date: string;
  reference_elevation_ft: number;
  /** Days the peak shifts for this town's elevation. Positive = later (lower). */
  elevation_shift_days: number;
  /** Days the September temperature anomaly moved it. Zero until Sept data lands. */
  thermal_shift_days: number;
  temp_anomaly_f: number | null;
  half_window_days: number;
}

export interface LeafThermal {
  reason?: string;
  normal_f?: number;
  normal_years?: number;
}

export interface LeafPrediction {
  slug: string;
  name: string;
  elevation_ft: number;
  county?: string;
  peak_start: string;
  peak_center: string;
  peak_end: string;
  components: LeafComponents;
  thermal?: LeafThermal;
  /** Plain-language provenance written by the model. Never paraphrase it away. */
  basis: string;
}

export interface LeafPredictions {
  model_version: string;
  generated_at: string;
  target_year: number;
  place_count: number;
  method: string;
  grading: string;
  predictions: LeafPrediction[];
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    return null;
  }
}

/** The whole artifact, or null when the model has not been run for this repo. */
export async function getLeafPredictions(): Promise<LeafPredictions | null> {
  return readJson<LeafPredictions>(join(DATA, "leaf", "predictions.json"));
}

/** One town's window. Slugs match the location registry exactly, Boone included. */
export async function getLeafPrediction(slug: string): Promise<LeafPrediction | null> {
  const all = await getLeafPredictions();
  return all?.predictions.find((p) => p.slug === slug) ?? null;
}

// --- pure helpers (tested; no filesystem) ----------------------------------

export interface ElevationBand {
  /** Band label, as the regional fall-color reports describe them. */
  label: string;
  /** One clause placing this town in the season, in DS voice. */
  blurb: string;
}

/**
 * The four elevation bands the NC mountain fall-color reports actually use.
 * Bands are a reader's handle on the gradient, not a model input: the model
 * works in continuous feet, so a town near a boundary is not treated specially.
 */
export function elevationBand(ft: number): ElevationBand {
  if (ft >= 5000) {
    return {
      label: "Above 5,000 feet",
      blurb: "the first ground in the High Country to turn, usually while the valleys are still green",
    };
  }
  if (ft >= 3500) {
    return {
      label: "3,500 to 5,000 feet",
      blurb: "high enough to turn well ahead of the valley towns, a step behind the exposed ridges",
    };
  }
  if (ft >= 2500) {
    return {
      label: "2,500 to 3,500 feet",
      blurb: "the mid band, where most of the High Country's towns sit and where the season runs longest",
    };
  }
  return {
    label: "Below 2,500 feet",
    blurb: "low enough that its color arrives after the mountains above it have already dropped",
  };
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function parts(d: string): { month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return null;
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { month, day };
}

/**
 * A peak window as one readable range: "October 12-22" inside a month,
 * "October 27-November 6" across one. En-dash, no spaces, per the house range
 * style. Returns "" for anything unparseable rather than rendering a stray dash.
 */
export function fmtPeakWindow(start: string, end: string): string {
  const a = parts(start);
  const b = parts(end);
  if (!a || !b) return "";
  const left = `${MONTHS[a.month - 1]} ${a.day}`;
  return a.month === b.month
    ? `${left}–${b.day}`
    : `${left}–${MONTHS[b.month - 1]} ${b.day}`;
}

/**
 * Whether this fall's September temperatures have actually moved the window
 * yet. False means the record is pure elevation climatology, which is the
 * honest state of the model any time it runs before late September.
 */
export function hasThermalSignal(p: LeafPrediction): boolean {
  return p.components.temp_anomaly_f !== null && p.components.thermal_shift_days !== 0;
}

/**
 * The model's elevation lapse rate, in days per 1,000 ft, recovered from the
 * record rather than hardcoded, so page copy can never drift from the model that
 * produced the number. Returns null at the reference elevation itself, where the
 * shift is zero and the rate is not recoverable by division.
 */
export function lapseRatePerThousandFt(p: LeafPrediction): number | null {
  const dropThousands = (p.components.reference_elevation_ft - p.elevation_ft) / 1000;
  if (Math.abs(dropThousands) < 0.05) return null;
  const rate = p.components.elevation_shift_days / dropThousands;
  if (!Number.isFinite(rate)) return null;
  return Math.round(rate * 10) / 10;
}

/** Days a finished window keeps earning its place on the page before it reads as stale. */
export const WINDOW_GRACE_DAYS = 45;

/**
 * Whether a prediction is still about the fall a reader cares about. A window
 * that closed more than a grace period ago is last year's news, and the site
 * rebuilds daily, so it simply stops rendering rather than sitting there
 * asserting a peak that already happened. `today` is injected so this is
 * testable and so the answer is fixed at build time.
 */
export function leafWindowIsCurrent(p: LeafPrediction, today: Date): boolean {
  const end = new Date(p.peak_end + "T12:00:00");
  if (Number.isNaN(end.getTime())) return false;
  const cutoff = new Date(end);
  cutoff.setDate(cutoff.getDate() + WINDOW_GRACE_DAYS);
  return today <= cutoff;
}

/**
 * How far this town sits behind the 5,000 ft reference, in whole days, as a
 * phrase: "about 12 days behind", "about 3 days ahead", "right about with".
 * The sign convention matches the model: positive elevation shift = later.
 */
export function ridgeOffsetPhrase(p: LeafPrediction): string {
  const days = Math.round(p.components.elevation_shift_days);
  if (days === 0) return "right about with the 5,000 foot ridges";
  const unit = Math.abs(days) === 1 ? "day" : "days";
  return days > 0
    ? `about ${days} ${unit} behind the 5,000 foot ridges`
    : `about ${Math.abs(days)} ${unit} ahead of the 5,000 foot ridges`;
}
