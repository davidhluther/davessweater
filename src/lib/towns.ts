// Town-aware data access for the public surface (API / feeds / widget).
//
// The site proper reads Boone from the legacy top-level data/ paths; every
// other tracked town lives under data/locations/<slug>/ (registry:
// data/locations/locations.json). This module unifies both so a single
// `getTownForecast5` / `getTownScores` / `getTownComparison` works for any slug.
//
// The one honesty rule (owner, 2026-07-25): a town is only exposed once it has
// crossed the SAME MIN_SCORED_DAYS gate the site uses for a source's track
// record. Boone is always exposed (its record is the flagship). Everything that
// enumerates towns (the /towns endpoint, the feed list) filters through
// `listPublicTowns`, so a thin sample is never dressed up as a public dataset.

import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Scores, Comparison } from "@/lib/types";
import { stripDays, type Forecast5Day, type StripDay } from "@/lib/forecast5";
import type { ForecastDisplay } from "@/lib/types";
import { MIN_SCORED_DAYS } from "@/lib/gating";

const DATA = join(process.cwd(), "data");

export interface Town {
  slug: string;
  name: string;
  lat: number;
  lon: number;
  elevation_ft: number;
  county?: string;
  /** Ray's Weather runs a station for this community (never borrowed). */
  has_rays: boolean;
}

// Boone is not in locations.json (it keeps the legacy top-level paths). Its
// coordinates come from CLAUDE.md; Ray's Weather is literally the Boone service,
// so has_rays is true. Elevation is the town's published ~3,333 ft.
const BOONE: Town = {
  slug: "boone",
  name: "Boone",
  lat: 36.2168,
  lon: -81.6746,
  elevation_ft: 3333,
  county: "Watauga",
  has_rays: true,
};

interface RawLocation {
  slug: string;
  name: string;
  lat: number;
  lon: number;
  elevation_ft: number;
  county?: string;
  rays_station_id?: string;
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    return null;
  }
}

// The full registry (Boone first, then locations.json in file order). Cached
// per-process — the file is committed and immutable within a build/deploy.
let registryCache: Town[] | null = null;
export async function allTowns(): Promise<Town[]> {
  if (registryCache) return registryCache;
  const raw = await readJson<{ locations: RawLocation[] }>(join(DATA, "locations", "locations.json"));
  const others = (raw?.locations ?? []).map((l) => ({
    slug: l.slug,
    name: l.name,
    lat: l.lat,
    lon: l.lon,
    elevation_ft: l.elevation_ft,
    county: l.county,
    has_rays: Boolean(l.rays_station_id),
  }));
  registryCache = [BOONE, ...others];
  return registryCache;
}

export async function getTown(slug: string): Promise<Town | null> {
  const towns = await allTowns();
  return towns.find((t) => t.slug === slug) ?? null;
}

/** Base data directory for a town's committed JSON. */
function townBase(slug: string): string {
  return slug === "boone" ? DATA : join(DATA, "locations", slug);
}

export async function getTownScores(slug: string): Promise<Scores | null> {
  return readJson<Scores>(join(townBase(slug), "scores.json"));
}

// A town's scored-day count = number of scored entries in its scoreboard. This
// is the metric the public gate reads (MIN_SCORED_DAYS). Boone always clears it.
export function scoredDays(scores: Scores | null): number {
  return Array.isArray(scores?.entries) ? scores!.entries.length : 0;
}

export async function isTownPublic(slug: string): Promise<boolean> {
  if (slug === "boone") return true;
  const scores = await getTownScores(slug);
  return scoredDays(scores) >= MIN_SCORED_DAYS;
}

export interface PublicTown extends Town {
  scored_days: number;
}

/** Registry filtered to towns past the gate (Boone always included), each with
 *  its scored-day count. Drives /api/v1/towns and the feed enumeration. */
export async function listPublicTowns(): Promise<PublicTown[]> {
  const towns = await allTowns();
  const out: PublicTown[] = [];
  for (const t of towns) {
    const days = t.slug === "boone" ? Number.POSITIVE_INFINITY : scoredDays(await getTownScores(t.slug));
    if (t.slug === "boone" || days >= MIN_SCORED_DAYS) {
      const scores = await getTownScores(t.slug);
      out.push({ ...t, scored_days: scoredDays(scores) });
    }
  }
  return out;
}

/** Slugs the public surface will serve, for self-documenting error responses. */
export async function publicSlugs(): Promise<string[]> {
  return (await listPublicTowns()).map((t) => t.slug);
}

export interface TownStatus extends Town {
  scored_days: number;
  /** Past the MIN_SCORED_DAYS gate (Boone always true). */
  is_public: boolean;
}

/** Every town in the registry with its scored-day count and public flag —
 *  drives the /weather hub, which shows the public towns as cards AND the
 *  not-yet-gated towns honestly, with their running counts (the gate is a
 *  feature, not a secret). Keyed off the SAME MIN_SCORED_DAYS gate as
 *  listPublicTowns, so a town crossing the bar flips is_public with no code
 *  change. */
export async function listTownsWithStatus(): Promise<TownStatus[]> {
  const towns = await allTowns();
  const out: TownStatus[] = [];
  for (const t of towns) {
    const days = scoredDays(await getTownScores(t.slug));
    out.push({ ...t, scored_days: days, is_public: t.slug === "boone" || days >= MIN_SCORED_DAYS });
  }
  return out;
}

/** A town's upcoming-day consensus strip (today first), assembled from its own
 *  captures via the same stripDays() the homepage uses. Empty when the town has
 *  no usable forecast yet. */
export async function getTownStrip(slug: string, max = 5): Promise<StripDay[]> {
  const f5 = await getTownForecast5(slug);
  return stripDays(f5, { max });
}

// ── Comparisons (the daily Right/Wrong Ray result) ─────────────────────────
export async function latestComparisonDate(slug: string): Promise<string | null> {
  const dir = join(townBase(slug), "comparisons");
  if (!existsSync(dir)) return null;
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  return files.length ? files[files.length - 1].replace(/\.json$/, "") : null;
}

export async function getTownComparison(slug: string, date: string): Promise<Comparison | null> {
  return readJson<Comparison>(join(townBase(slug), "comparisons", `${date}.json`));
}

// ── Multi-day forecast ─────────────────────────────────────────────────────
// Boone has a precomputed data/forecast_5day.json (built by the pipeline);
// other towns don't, so we assemble the same Forecast5Day shape from their
// latest per-source capture files. Both feed compositeForecast()/stripDays()
// unchanged.

interface CaptureDaily {
  date: string;
  high_f?: number | null;
  low_f?: number | null;
  wind_mph?: number | null;
  precip_type?: string | null;
  precip_prob?: number | null;
}
interface Capture {
  source: string;
  label?: string;
  daily?: CaptureDaily[];
}

const roundWind = (mph?: number | null): string | null =>
  typeof mph === "number" && Number.isFinite(mph) ? `${Math.round(mph)} mph` : null;

/**
 * Pivot a set of per-source capture files (each a `daily[]` timeseries) into a
 * date-major Forecast5Day, the shape the site's consensus code consumes. Pure —
 * unit-tested against synthetic captures.
 */
export function buildForecast5FromCaptures(
  captures: Capture[],
  location: string,
  generatedAt: string,
): Forecast5Day {
  const byDate = new Map<string, Record<string, ForecastDisplay & { precip_prob?: number }>>();
  const order: string[] = [];
  for (const cap of captures) {
    for (const d of cap.daily ?? []) {
      if (!d?.date) continue;
      if (!byDate.has(d.date)) {
        byDate.set(d.date, {});
        order.push(d.date);
      }
      const row: ForecastDisplay & { precip_prob?: number } = {
        label: cap.label ?? cap.source,
        high_f: typeof d.high_f === "number" ? d.high_f : null,
        low_f: typeof d.low_f === "number" ? d.low_f : null,
        wind: roundWind(d.wind_mph),
        precip_type: d.precip_type ?? null,
      };
      if (typeof d.precip_prob === "number") row.precip_prob = d.precip_prob;
      byDate.get(d.date)![cap.source] = row;
    }
  }
  const days = order
    .sort((a, b) => a.localeCompare(b))
    .map((date) => ({ date, sources: byDate.get(date)! }));
  return { generated_at: generatedAt, location, days };
}

export async function getTownForecast5(slug: string): Promise<Forecast5Day | null> {
  if (slug === "boone") {
    return readJson<Forecast5Day>(join(DATA, "forecast_5day.json"));
  }
  const predDir = join(townBase(slug), "predictions");
  if (!existsSync(predDir)) return null;
  const dates = (await readdir(predDir)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  if (!dates.length) return null;
  // Prefer the most recent capture day that holds a multi-source snapshot
  // (>= 2 forecasts). On a partial day only Ray's may have run — his forecast
  // is one request, the keyed sources rotate under quota — and one source has
  // no consensus to show. Fall back to the newest non-empty day if none has
  // two, so a lone-Ray latest day doesn't blank the forecast.
  let chosen: string | null = null;
  let fallback: string | null = null;
  for (let i = dates.length - 1; i >= 0; i--) {
    const files = (await readdir(join(predDir, dates[i]))).filter((f) => f.endsWith("_forecast.json"));
    if (!files.length) continue;
    if (!fallback) fallback = dates[i];
    if (files.length >= 2) { chosen = dates[i]; break; }
  }
  const date = chosen ?? fallback;
  if (!date) return null;
  const dir = join(predDir, date);
  const files = (await readdir(dir)).filter((f) => f.endsWith("_forecast.json"));
  const captures: Capture[] = [];
  for (const f of files) {
    const cap = await readJson<Capture>(join(dir, f));
    if (cap) captures.push(cap);
  }
  if (!captures.length) return null;
  const town = await getTown(slug);
  return buildForecast5FromCaptures(captures, town?.name ?? slug, `${date}T12:00:00`);
}
