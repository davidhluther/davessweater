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
// pages, and anything downstream all come through here rather than each parsing
// the JSON their own way. (The tourism busy-ness up-weight reads the same
// artifact on the Python side, in scripts/compute_busyness.py.)

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

/** One graded row from scripts/score_leaf.py — empty until October. */
export interface LeafScore {
  slug: string;
  name: string;
  elevation_ft: number;
  predicted_start: string;
  predicted_end: string;
  observed: string | { start: string; end: string };
  source_id?: string | null;
  observed_on?: string | null;
  abs_error_days: number;
  signed_error_days: number;
  window_hit: boolean;
  score: number;
  grade: string;
  predicted_center: string;
  observed_center: string;
}

export interface LeafScoreboard {
  scored_at: string;
  model_version?: string;
  target_year?: number;
  summary: {
    scored_rows: number;
    towns_scored: number;
    mean_score: number | null;
    mean_abs_error_days: number | null;
    mean_signed_error_days: number | null;
    window_hit_rate: number | null;
  };
  scores: LeafScore[];
}

export interface LeafGradingSource {
  id: string;
  purpose: string;
  url: string;
  notes?: string;
  /** Owner's no-cite ruling for this source (2026-09-03, fallcolorguy.org): the
   *  registry still gates score_leaf.py by `purpose`, but a source flagged
   *  internal_only must never be named or linked on a public page. */
  internal_only?: boolean;
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

/**
 * The graded scoreboard, once October observations exist. Null before the
 * scorer has ever run; `summary.scored_rows` is 0 until the first observation
 * is recorded by hand. Callers must render the empty state rather than an
 * average of nothing.
 */
export async function getLeafScoreboard(): Promise<LeafScoreboard | null> {
  return readJson<LeafScoreboard>(join(DATA, "leaf", "scores.json"));
}

/**
 * The published fall-color reports we grade against, read from the event
 * registry so the page cites exactly what the scorer was pointed at. Filtered
 * by the registry's own `purpose` field rather than by a list kept here.
 *
 * Also drops any source flagged `internal_only` (fallcolorguy.org, 2026-09-03
 * owner ruling: his site is used as a data source but never named or linked on
 * a public page). score_leaf.py has no such filter -- it grades against every
 * source carrying the grading purpose, internal_only or not. This function is
 * the ONLY place that boundary is enforced, so any new public consumer of
 * grading sources must call this, not read the registry directly.
 */
export async function getLeafGradingSources(): Promise<LeafGradingSource[]> {
  const registry = await readJson<{ grading_sources?: LeafGradingSource[] }>(
    join(DATA, "events", "registry.json")
  );
  return (registry?.grading_sources ?? []).filter(
    (s) => s.purpose === "leaf-model grading" && !s.internal_only
  );
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

// --- cross-town helpers: the /leaf hub's view of the same data --------------
//
// The town pages carry one window each. The hub's job is the gradient itself --
// the thing 18 places spanning 4,435 feet of elevation can show that no single
// town page can -- so these helpers summarize across the whole set.

/** Days between two ISO dates, or null if either is unparseable. */
function daysBetween(from: string, to: string): number | null {
  const a = Date.parse(from + "T12:00:00Z");
  const b = Date.parse(to + "T12:00:00Z");
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

export interface LeafSeasonSpan {
  /** Earliest predicted peak_start across every town. */
  start: string;
  /** Latest predicted peak_end across every town. */
  end: string;
  /** Inclusive length of the whole season in days. */
  days: number;
}

/**
 * The season's outer bounds: the first day any tracked town is predicted at
 * peak through the last day any of them still is. Null for an empty set rather
 * than a zero-length season.
 */
export function leafSeasonSpan(predictions: LeafPrediction[]): LeafSeasonSpan | null {
  const starts = predictions.map((p) => p.peak_start).filter(Boolean).sort();
  const ends = predictions.map((p) => p.peak_end).filter(Boolean).sort();
  if (!starts.length || !ends.length) return null;
  const start = starts[0];
  const end = ends[ends.length - 1];
  const days = daysBetween(start, end);
  if (days === null) return null;
  return { start, end, days: days + 1 };
}

export interface LeafBandRow extends ElevationBand {
  /** Towns in this band, earliest peak first. */
  towns: LeafPrediction[];
  /** Earliest peak_start in the band. */
  start: string;
  /** Latest peak_end in the band. */
  end: string;
}

/**
 * The four elevation bands, highest first, each collapsed to the span its towns
 * cover. Bands with no tracked town in them are omitted — the page shows the
 * footprint we actually measure, not an empty row for a band we do not reach.
 */
export function leafBandRows(predictions: LeafPrediction[]): LeafBandRow[] {
  const byLabel = new Map<string, LeafPrediction[]>();
  for (const p of predictions) {
    const { label } = elevationBand(p.elevation_ft);
    byLabel.set(label, [...(byLabel.get(label) ?? []), p]);
  }
  const order = [5000, 3500, 2500, 0];
  const rows: LeafBandRow[] = [];
  for (const ft of order) {
    const band = elevationBand(ft);
    const towns = byLabel.get(band.label);
    if (!towns?.length) continue;
    const sorted = [...towns].sort((a, b) => a.peak_start.localeCompare(b.peak_start));
    rows.push({
      ...band,
      towns: sorted,
      start: sorted.map((t) => t.peak_start).sort()[0],
      end: sorted.map((t) => t.peak_end).sort().slice(-1)[0],
    });
  }
  return rows;
}

export interface LeafBarPosition {
  /** Left edge as a percentage of the season track. */
  leftPct: number;
  /** Width as a percentage of the season track. */
  widthPct: number;
}

/**
 * Where one window sits on a bar spanning the whole season, as percentages, so
 * the strip is drawn from the data instead of from hand-placed pixels. Clamped
 * to the track: a window reaching the edge renders flush rather than spilling
 * outside the bar it is supposed to sit inside. Null when the span is
 * degenerate, so a caller renders nothing instead of a divide-by-zero bar.
 */
export function leafBarPosition(
  span: LeafSeasonSpan, start: string, end: string
): LeafBarPosition | null {
  if (span.days <= 1) return null;
  const offset = daysBetween(span.start, start);
  const length = daysBetween(start, end);
  if (offset === null || length === null) return null;
  const total = span.days;
  const leftPct = Math.max(0, Math.min(100, (offset / total) * 100));
  const widthPct = Math.max(0, Math.min(100 - leftPct, ((length + 1) / total) * 100));
  return { leftPct, widthPct };
}

/**
 * The season's two bookends as one sentence fragment, used in the hub's lede
 * and its share card: the first town to turn and the last, named. Empty string
 * for an empty set.
 */
export function leafBookends(predictions: LeafPrediction[]): { first: LeafPrediction; last: LeafPrediction } | null {
  if (!predictions.length) return null;
  const sorted = [...predictions].sort((a, b) => a.peak_center.localeCompare(b.peak_center));
  return { first: sorted[0], last: sorted[sorted.length - 1] };
}

/**
 * Predictions ordered the way the gradient reads: earliest peak first, and
 * highest ground first among ties, which is the same order the model writes but
 * re-established here so a hand-edited artifact still renders in season order.
 */
export function leafByPeak(predictions: LeafPrediction[]): LeafPrediction[] {
  return [...predictions].sort(
    (a, b) => a.peak_center.localeCompare(b.peak_center) || b.elevation_ft - a.elevation_ft
  );
}
