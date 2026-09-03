// The single reader for the tourism / Busy-ness Index artifacts, plus the pure
// derivations the page and the API both render.
//
// Same read-the-repo pattern as roads.ts and leaf.ts: the Python pipeline
// commits JSON every morning, the site reads it, nothing is fetched at request
// time.
//
//   scripts/compute_busyness.py      -> data/demand/index/{issued}.json
//   scripts/capture_lodging_demand.py -> data/demand/{captured}.json
//   scripts/capture_str_pacing.py     -> data/demand/str/{captured}.json
//   data/events/registry.json         -> the named events behind a score
//
// WHY THE "VS TYPICAL" MATH LIVES HERE AND NOT IN THE ENGINE
// The index engine scores one day at a time and says so honestly: its bands are
// absolute, because on the day it was written there was no history to compare a
// date against. The comparison is a different question, asked across every file
// the pipeline has ever written, and the answer changes for past dates as more
// history accrues. Computing it here means it applies to the whole archive the
// moment the archive is long enough, instead of only to days scored after some
// deployment. The engine stays the single capture point; this is aggregation
// over what it captured, the same division of labor as the scoreboard.
//
// Everything below the readers is pure and unit-tested (tourism.test.ts).

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const DATA = join(process.cwd(), "data");
const DATE_FILE = /^(\d{4}-\d{2}-\d{2})\.json$/;

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    return null;
  }
}

/** Dated filenames in a directory, oldest first. */
async function datedFiles(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir)).filter((f) => DATE_FILE.test(f)).sort();
  } catch {
    return [];
  }
}

// ── shapes ──────────────────────────────────────────────────────────────────

export type BusynessBand = "calm" | "typical" | "busy" | "slammed";

export interface BusynessComponents {
  hotel: number;
  str: number;
  events: number;
  leaf: number;
  weekend: number;
}

export interface BusynessDay {
  date: string;
  score: number;
  band: BusynessBand;
  components: BusynessComponents;
  drivers: string[];
  events: string[];
}

export interface BusynessIndex {
  computed_at: string;
  provisional: boolean;
  /** The engine's own caveat, passed through verbatim by the API. */
  provisional_note?: string;
  horizon: BusynessDay[];
  missing_inputs: string[];
}

export interface LodgingTownStay {
  median_min_rate: number | null;
  hotels_reporting: number;
}

export interface LodgingCapture {
  fetched_at: string;
  source: string;
  notes?: string[];
  target_stays?: { chk_in: string; chk_out: string }[];
  summary: {
    towns: Record<string, Record<string, LodgingTownStay>>;
    high_share: Record<string, number>;
  };
}

export interface RegistryEvent {
  id: string;
  name: string;
  type?: string;
  towns?: string[];
  magnitude?: string;
  dates?: string[];
  date_range?: { start: string; end: string };
}

/** One (issued, target) pair pulled out of the index archive. */
export interface IndexObservation {
  issued: string;
  date: string;
  score: number;
  band: BusynessBand;
}

// ── date helpers (pure, timezone-free) ──────────────────────────────────────

function toUtcMs(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
}

/** Day of week for an ISO date, 0 = Sunday. Computed arithmetically so the
 *  answer never depends on the machine's timezone. */
export function isoWeekday(iso: string): number {
  return new Date(toUtcMs(iso)).getUTCDay();
}

/** Whole days from `from` to `to`. Negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / 86_400_000);
}

/** How far ahead a scored date was when the index was issued. */
export function leadDays(issued: string, target: string): number {
  return daysBetween(issued, target);
}

/** Friday and Saturday are the region's weekend nights — the engine's own
 *  +5 bonus lands on exactly those two, so the comparison pool uses the same
 *  split rather than inventing a second definition. */
export function dayClass(iso: string): "weekend" | "weekday" {
  const wd = isoWeekday(iso);
  return wd === 5 || wd === 6 ? "weekend" : "weekday";
}

const WEEKDAY_LONG = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

/** Weekday name from the date string alone. `toLocaleDateString` would resolve
 *  the same ISO date to the previous day under a negative UTC offset, which is
 *  exactly the timezone this site lives in. */
export function weekdayLong(iso: string): string {
  return WEEKDAY_LONG[isoWeekday(iso)];
}

export function addDays(iso: string, n: number): string {
  return new Date(toUtcMs(iso) + n * 86_400_000).toISOString().slice(0, 10);
}

// ── bands ───────────────────────────────────────────────────────────────────

/** Mirrors the thresholds in scripts/compute_busyness.py. Kept here so the page
 *  can band a score it derived itself; the engine remains the source of the
 *  band it publishes. */
export function bandOf(score: number): BusynessBand {
  if (score >= 75) return "slammed";
  if (score >= 55) return "busy";
  if (score >= 35) return "typical";
  return "calm";
}

export const BAND_ORDER: BusynessBand[] = ["calm", "typical", "busy", "slammed"];

// ── vs-typical percentile ───────────────────────────────────────────────────

/** Minimum comparable nights before a percentile is worth printing. Below this
 *  the number would swing on a single observation, so we say nothing instead. */
export const MIN_COMPARABLE = 12;

/** Lead-time tolerance, in days, for a night to count as comparable. */
export const LEAD_TOLERANCE = 2;

/** Mid-rank percentile: the share of the pool strictly below `value`, plus half
 *  the ties. Ties split so a score sitting on a crowded value is not reported as
 *  beating every one of its equals. Returns 0-100. */
export function percentileRank(pool: number[], value: number): number {
  if (!pool.length) return 0;
  let below = 0;
  let equal = 0;
  for (const v of pool) {
    if (v < value) below += 1;
    else if (v === value) equal += 1;
  }
  return ((below + equal / 2) / pool.length) * 100;
}

/** The nights a given scored night can honestly be compared against.
 *
 *  Two controls, both forced on us by how the index is built:
 *  - DAY CLASS, because the engine adds a flat weekend bonus and lodging prices
 *    weekends differently, so a Saturday compared against Tuesdays would rank
 *    high for reasons that have nothing to do with this Saturday.
 *  - LEAD TIME, because STR fill rises continuously as a date approaches. That
 *    bias is documented in the engine and deliberately uncorrected there, so a
 *    date read three days out must be compared with other dates read three days
 *    out or the ranking measures the calendar rather than the crowd.
 *
 *  The target's own date is excluded: the same night scored at other leads is
 *  the same night, not a comparison. */
export function comparablePool(
  observations: IndexObservation[],
  target: { issued: string; date: string },
  opts: { leadTolerance?: number } = {},
): number[] {
  const tol = opts.leadTolerance ?? LEAD_TOLERANCE;
  const wantClass = dayClass(target.date);
  const wantLead = leadDays(target.issued, target.date);
  const pool: number[] = [];
  for (const o of observations) {
    if (o.date === target.date) continue;
    if (dayClass(o.date) !== wantClass) continue;
    if (Math.abs(leadDays(o.issued, o.date) - wantLead) > tol) continue;
    pool.push(o.score);
  }
  return pool;
}

export interface VsTypical {
  percentile: number;
  sampleSize: number;
  /** Median of the comparable pool — the "typical" the percentile is against. */
  median: number;
  dayClass: "weekend" | "weekday";
  leadDays: number;
  /** Oldest and newest night in the pool, so the page can state the record's span. */
  from: string;
  to: string;
}

/** Where a scored night sits against comparable nights in the archive, or null
 *  when the archive cannot yet answer honestly. */
export function vsTypical(
  observations: IndexObservation[],
  target: { issued: string; date: string; score: number },
  opts: { leadTolerance?: number; minComparable?: number } = {},
): VsTypical | null {
  const min = opts.minComparable ?? MIN_COMPARABLE;
  const tol = opts.leadTolerance ?? LEAD_TOLERANCE;
  const wantClass = dayClass(target.date);
  const wantLead = leadDays(target.issued, target.date);
  const matched = observations.filter(
    (o) =>
      o.date !== target.date &&
      dayClass(o.date) === wantClass &&
      Math.abs(leadDays(o.issued, o.date) - wantLead) <= tol,
  );
  if (matched.length < min) return null;
  const scores = matched.map((o) => o.score).sort((a, b) => a - b);
  const dates = matched.map((o) => o.date).sort();
  const mid = Math.floor(scores.length / 2);
  const median =
    scores.length % 2 === 0 ? (scores[mid - 1] + scores[mid]) / 2 : scores[mid];
  return {
    percentile: Math.round(percentileRank(scores, target.score)),
    sampleSize: scores.length,
    median: Math.round(median * 10) / 10,
    dayClass: wantClass,
    leadDays: wantLead,
    from: dates[0],
    to: dates[dates.length - 1],
  };
}

// ── the weekend call ────────────────────────────────────────────────────────

export interface WeekendCall {
  friday: BusynessDay | null;
  saturday: BusynessDay | null;
  /** The night the headline speaks for: the busier of the two. */
  peak: BusynessDay;
}

/** The next Friday and Saturday at or after `from`, out of a 14-day horizon.
 *  On a Saturday the current night still counts — the question "how busy is it
 *  this weekend" is not retired at breakfast. */
export function upcomingWeekend(horizon: BusynessDay[], from: string): WeekendCall | null {
  const ahead = horizon.filter((d) => d.date >= from).sort((a, b) => a.date.localeCompare(b.date));
  const saturday = ahead.find((d) => isoWeekday(d.date) === 6) ?? null;
  // The Friday of the SAME weekend as that Saturday, not merely the next Friday
  // — on a Saturday those are eight days apart and pairing them would be wrong.
  const friday = saturday
    ? (ahead.find((d) => d.date === addDays(saturday.date, -1)) ?? null)
    : (ahead.find((d) => isoWeekday(d.date) === 5) ?? null);
  const candidates = [friday, saturday].filter((d): d is BusynessDay => d !== null);
  if (!candidates.length) return null;
  const peak = candidates.reduce((a, b) => (b.score > a.score ? b : a));
  return { friday, saturday, peak };
}

// ── cross-confirmation ──────────────────────────────────────────────────────

export interface CrossConfirmed {
  date: string;
  score: number;
  band: BusynessBand;
  /** Share of tracked towns at predicted peak color, back out of the capped points. */
  leafShare: number;
  /** Share of rostered hotels pricing the night high, back out of its points. */
  hotelShare: number;
}

/** Nights where two INDEPENDENT signals agree: our own leaf model says the
 *  region is at peak color, and the hotels have separately priced the night
 *  high. The leaf model knows nothing about lodging and the hotels know nothing
 *  about our model, so agreement is worth more than either reading alone, and
 *  disagreement is worth saying out loud too.
 *
 *  Shares are recovered from the published points by dividing by the component
 *  caps the engine used, so this never re-derives either signal from raw inputs
 *  and cannot drift from what the score actually contains. */
export function crossConfirmation(
  horizon: BusynessDay[],
  opts: { leafMax?: number; hotelMax?: number; minLeaf?: number; minHotel?: number } = {},
): CrossConfirmed[] {
  const leafMax = opts.leafMax ?? 15;
  const hotelMax = opts.hotelMax ?? 40;
  const minLeaf = opts.minLeaf ?? 0.5;
  const minHotel = opts.minHotel ?? 0.5;
  const out: CrossConfirmed[] = [];
  for (const d of horizon) {
    const leafShare = (d.components?.leaf ?? 0) / leafMax;
    const hotelShare = (d.components?.hotel ?? 0) / hotelMax;
    if (leafShare >= minLeaf && hotelShare >= minHotel) {
      out.push({ date: d.date, score: d.score, band: d.band, leafShare, hotelShare });
    }
  }
  return out;
}

// ── heat calendar ───────────────────────────────────────────────────────────

export interface HeatDay {
  date: string;
  /** Fraction of rostered hotels pricing this date "high", or null if the
   *  capture carried no band for it. Never coerced to zero: an unpriced day and
   *  a cheap day are different facts. */
  share: number | null;
}

export function heatCalendarDays(
  highShare: Record<string, number> | undefined,
  start: string,
  days: number,
): HeatDay[] {
  const out: HeatDay[] = [];
  for (let i = 0; i < days; i += 1) {
    const date = addDays(start, i);
    const share = highShare?.[date];
    out.push({ date, share: typeof share === "number" ? share : null });
  }
  return out;
}

/** Five buckets for shading. `null` share stays null so the cell can render as
 *  "no reading" rather than as the coldest colour. */
export function heatBucket(share: number | null): 0 | 1 | 2 | 3 | 4 | null {
  if (share === null) return null;
  if (share >= 0.8) return 4;
  if (share >= 0.5) return 3;
  if (share >= 0.25) return 2;
  if (share >= 0.05) return 1;
  return 0;
}

// ── weekend rate trend ──────────────────────────────────────────────────────

export interface RateObservation {
  /** The night being priced. */
  stay: string;
  /** The morning the price was read. */
  captured: string;
  lead: number;
  median: number;
  hotels: number;
}

export interface RatePoint {
  stay: string;
  median: number;
  hotels: number;
  lead: number;
}

/** Flatten every daily lodging capture into one priced-night-per-row list. */
export function rateObservations(
  captures: { captured: string; capture: LodgingCapture }[],
  town: string,
): RateObservation[] {
  const out: RateObservation[] = [];
  for (const { captured, capture } of captures) {
    const stays = capture.summary?.towns?.[town];
    if (!stays) continue;
    for (const [stay, row] of Object.entries(stays)) {
      if (typeof row?.median_min_rate !== "number") continue;
      out.push({
        stay,
        captured,
        lead: leadDays(captured, stay),
        median: row.median_min_rate,
        hotels: row.hotels_reporting ?? 0,
      });
    }
  }
  return out;
}

/** The weekend rate trend, READ AT A MATCHED LEAD TIME.
 *
 *  Hotel rates drift as a date approaches, so lining up each weekend's newest
 *  reading would compare a night read yesterday against a night read two weeks
 *  out and call the difference seasonality. Instead every point is the reading
 *  taken closest to `lead` days before the stay, and a weekend with no reading
 *  inside `tolerance` is dropped rather than fudged — which is the correct
 *  answer for a weekend still too far out to have been read at that lead. */
export function weekendRateSeries(
  observations: RateObservation[],
  opts: { weekday?: number; lead?: number; tolerance?: number } = {},
): { points: RatePoint[]; excluded: string[] } {
  const weekday = opts.weekday ?? 6;
  const lead = opts.lead ?? 3;
  const tolerance = opts.tolerance ?? 3;
  const byStay = new Map<string, RateObservation[]>();
  for (const o of observations) {
    if (isoWeekday(o.stay) !== weekday) continue;
    const list = byStay.get(o.stay);
    if (list) list.push(o);
    else byStay.set(o.stay, [o]);
  }
  const points: RatePoint[] = [];
  const excluded: string[] = [];
  for (const stay of [...byStay.keys()].sort()) {
    const best = byStay
      .get(stay)!
      .reduce((a, b) => (Math.abs(b.lead - lead) < Math.abs(a.lead - lead) ? b : a));
    if (Math.abs(best.lead - lead) > tolerance) {
      excluded.push(stay);
      continue;
    }
    points.push({ stay, median: best.median, hotels: best.hotels, lead: best.lead });
  }
  return { points, excluded };
}

/** Median of a numeric list. Used for the trend's own baseline line. */
export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

// ── event overlay ───────────────────────────────────────────────────────────

export interface OverlayEvent {
  id: string;
  name: string;
  dates: string[];
}

/** The named events the engine actually counted inside the horizon, joined back
 *  to the registry for their real names. An id the registry does not know (the
 *  athletics feed writes its own) still appears, carrying the id as its name so
 *  the overlay can never silently drop a driver the score included. */
export function eventOverlay(
  horizon: BusynessDay[],
  registry: RegistryEvent[],
  athleticsNames: Record<string, string> = {},
): OverlayEvent[] {
  const byId = new Map(registry.map((e) => [e.id, e]));
  const seen = new Map<string, OverlayEvent>();
  for (const day of horizon) {
    for (const id of day.events ?? []) {
      const existing = seen.get(id);
      if (existing) {
        existing.dates.push(day.date);
        continue;
      }
      seen.set(id, {
        id,
        name: byId.get(id)?.name ?? athleticsNames[id] ?? id,
        dates: [day.date],
      });
    }
  }
  return [...seen.values()].sort((a, b) => a.dates[0].localeCompare(b.dates[0]));
}

// ── readers ─────────────────────────────────────────────────────────────────

/** The newest committed Busy-ness Index, with the date it was issued. */
export async function getBusynessIndex(): Promise<{ issued: string; index: BusynessIndex } | null> {
  const dir = join(DATA, "demand", "index");
  const files = await datedFiles(dir);
  const newest = files[files.length - 1];
  if (!newest) return null;
  const index = await readJson<BusynessIndex>(join(dir, newest));
  if (!index?.horizon?.length) return null;
  return { issued: newest.slice(0, 10), index };
}

/** Every (issued, target) pair the archive holds — the comparison corpus. */
export async function getBusynessObservations(): Promise<IndexObservation[]> {
  const dir = join(DATA, "demand", "index");
  const files = await datedFiles(dir);
  const out: IndexObservation[] = [];
  for (const file of files) {
    const issued = file.slice(0, 10);
    const index = await readJson<BusynessIndex>(join(dir, file));
    for (const day of index?.horizon ?? []) {
      if (typeof day.score !== "number" || !day.date) continue;
      out.push({ issued, date: day.date, score: day.score, band: day.band });
    }
  }
  return out;
}

/** How many mornings the index has run. The honest denominator behind any
 *  "vs typical" claim, and what the page states rather than implying depth. */
export async function getBusynessArchiveSpan(): Promise<{ days: number; from: string; to: string } | null> {
  const files = await datedFiles(join(DATA, "demand", "index"));
  if (!files.length) return null;
  return {
    days: files.length,
    from: files[0].slice(0, 10),
    to: files[files.length - 1].slice(0, 10),
  };
}

/** The newest lodging capture (hotel bands + median rates). */
export async function getLodgingCapture(): Promise<{ captured: string; capture: LodgingCapture } | null> {
  const dir = join(DATA, "demand");
  const files = await datedFiles(dir);
  const newest = files[files.length - 1];
  if (!newest) return null;
  const capture = await readJson<LodgingCapture>(join(dir, newest));
  if (!capture?.summary) return null;
  return { captured: newest.slice(0, 10), capture };
}

/** Every lodging capture, oldest first — the rate-trend corpus. */
export async function getLodgingCaptures(): Promise<{ captured: string; capture: LodgingCapture }[]> {
  const dir = join(DATA, "demand");
  const out: { captured: string; capture: LodgingCapture }[] = [];
  for (const file of await datedFiles(dir)) {
    const capture = await readJson<LodgingCapture>(join(dir, file));
    if (capture?.summary) out.push({ captured: file.slice(0, 10), capture });
  }
  return out;
}

export async function getRegistryEvents(): Promise<RegistryEvent[]> {
  const registry = await readJson<{ events?: RegistryEvent[]; seasons?: RegistryEvent[] }>(
    join(DATA, "events", "registry.json"),
  );
  return [...(registry?.events ?? []), ...(registry?.seasons ?? [])];
}

/** An App State home game that came from the live ICS feed rather than the
 *  registry carries the calendar's own `uid` as its id, which is not a name a
 *  reader should ever see. Map those back to the game's summary line. */
export function athleticsName(summary: string): string {
  return summary
    .replace(/^Appalachian State University\s+/, "App State ")
    .replace(/\s+-\s+.*$/, "")
    .trim();
}

export async function getAthleticsNames(): Promise<Record<string, string>> {
  const data = await readJson<{
    feeds?: Record<string, { uid?: string; summary?: string; home?: boolean }[]>;
  }>(join(DATA, "events", "athletics.json"));
  const out: Record<string, string> = {};
  for (const games of Object.values(data?.feeds ?? {})) {
    for (const g of games) {
      if (g.uid && g.summary) out[g.uid] = athleticsName(g.summary);
    }
  }
  return out;
}
