// Terrain line-of-sight for /fireworks: can a given spot see a given show's
// bursts? Pure math — elevation access is injected (browser: canvas-decoded
// AWS terrain tiles via SightlineChecker; offline: scripts/compute_terrain.mjs
// with sharp — keep the formulas in sync, they are cross-referenced).
//
// Model, stated plainly because it renders on the page: USGS NED 10m
// bare-earth DEM served as web-mercator terrarium tiles (z13, ~15 m/px at
// 36°N); earth curvature with a k=0.13 optical-refraction allowance; observer
// eye 2 m above the local high ground (max of a 5×5 box within ±50 m — this
// absorbs street-line geocode error and means "walk to the good corner of the
// yard"). Trees and buildings are NOT in the model; MARGIN_NOISE_M turns that
// honesty into the "marginal" verdict instead of a false binary.

import type { HorizonPoint } from "@/lib/solar";

export interface LatLon {
  lat: number;
  lon: number;
}

/** Shapes of data/terrain.json, produced by scripts/compute_terrain.mjs. */
export interface ViewpointResult {
  distanceM: number;
  margin90M: number;
  margin150M: number;
  blockerKm: number | null;
  requiredAGLM: number;
}

export interface Viewpoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  note: string;
  groundM: number;
  results: Record<string, ViewpointResult>;
  /** Venue ids whose verdict flips when the pin moves ±100 m — render as a maybe. */
  sensitive?: string[];
  environment?: SpotEnvironment;
}

export interface TerrainFile {
  schema_version: number;
  computed_at: string;
  dem: string;
  horizons: Record<string, HorizonPoint[]>;
  viewpoints: Viewpoint[];
}

/** Elevation lookup, meters above sea level. Injected so math stays pure. */
export type ElevFn = (lat: number, lon: number) => Promise<number>;

export const TILE_Z = 13;
export const EYE_M = 2;
export const BURST_TYPICAL_M = 90; // ≈300 ft — typical municipal shell apex
export const BURST_FINALE_M = 150; // ≈500 ft — the big finale shells
export const MARGIN_NOISE_M = 15; // DEM + geocode noise band
const R_EFF_M = 6_371_000 / (1 - 0.13);

/** Web-mercator tile + pixel for a point. */
export function tileCoords(lat: number, lon: number, z: number = TILE_Z) {
  const n = 2 ** z;
  const x = ((lon + 180) / 360) * n;
  const rad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  return {
    tx, ty,
    px: Math.min(255, Math.floor((x - tx) * 256)),
    py: Math.min(255, Math.floor((y - ty) * 256)),
  };
}

/** Terrarium RGB encoding → meters. (128,0,0) is sea level. */
export function terrariumElevationM(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768;
}

const toRad = (d: number) => (d * Math.PI) / 180;

export function haversineM(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(s));
}

const lerp = (a: LatLon, b: LatLon, t: number): LatLon => ({
  lat: a.lat + (b.lat - a.lat) * t,
  lon: a.lon + (b.lon - a.lon) * t,
});

/** Local high ground: max elevation in a 5×5 box (±boxM) around a point. */
export async function bestGroundNear(getElev: ElevFn, p: LatLon, boxM = 50): Promise<number> {
  let best = -Infinity;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const lat = p.lat + ((dy * boxM) / 2 / 6_371_000) * (180 / Math.PI);
      const lon = p.lon + ((dx * boxM) / 2 / (6_371_000 * Math.cos(toRad(p.lat)))) * (180 / Math.PI);
      best = Math.max(best, await getElev(lat, lon));
    }
  }
  return best;
}

export interface LosResult {
  distanceM: number;
  /** Worst clearance (m) between the sightline and terrain; >0 means clear. */
  marginM: number;
  /** Where the worst blocker sits, km from the observer (null if clear). */
  blockerKm: number | null;
  /** Burst height (m AGL) that would just clear everything. */
  requiredAGLM: number;
}

/**
 * Line of sight from an observer (eye above obsGroundM) to a burst at
 * burstAGLM above the target's ground. Earth-bulge corrected relative to the
 * chord. Samples every stepM; skips the first 120 m and last 60 m (the DEM
 * can't speak to your porch railing or the launch racks).
 */
export async function losToBurst(
  getElev: ElevFn,
  obs: LatLon,
  obsGroundM: number,
  target: LatLon,
  burstAGLM: number,
  stepM = 30,
): Promise<LosResult> {
  const D = haversineM(obs, target);
  const h0 = obsGroundM + EYE_M;
  const h1 = (await getElev(target.lat, target.lon)) + burstAGLM;
  const n = Math.max(8, Math.round(D / stepM));
  let minClear = Infinity;
  let blockerM: number | null = null;
  let requiredLift = 0;
  for (let i = 1; i < n; i++) {
    const d = (D * i) / n;
    if (d < 120 || D - d < 60) continue;
    const p = lerp(obs, target, i / n);
    const terrain = await getElev(p.lat, p.lon);
    const bulge = (d * (D - d)) / (2 * R_EFF_M);
    const clear = h0 + ((h1 - h0) * d) / D - (terrain + bulge);
    if (clear < minClear) {
      minClear = clear;
      blockerM = d;
    }
    const lift = (-clear * D) / d;
    if (lift > requiredLift) requiredLift = lift;
  }
  if (minClear === Infinity) {
    // Too close for any mid-path sample — you are effectively at the show.
    return { distanceM: D, marginM: burstAGLM, blockerKm: null, requiredAGLM: burstAGLM };
  }
  return {
    distanceM: D,
    marginM: minClear,
    blockerKm: minClear > 0 ? null : (blockerM as number) / 1000,
    requiredAGLM: burstAGLM + Math.max(0, requiredLift),
  };
}

// Display helpers — the math is metric; the audience is not.
export const ftFromM = (m: number): number => Math.round(m * 3.28084);
/** Rounded to 50 ft, for spec-style labels (90 m → "300 ft"). */
export const ftFromM50 = (m: number): number => Math.round((m * 3.28084) / 50) * 50;
export const miFromM = (m: number): number => Math.round((m / 1609.344) * 10) / 10;
export const miFromKm = (km: number): number => Math.round(km * 0.621371 * 10) / 10;

export type SightVerdict = "clear" | "finale-only" | "marginal" | "blocked";

/** What surrounds a known viewing spot. The DEM is bare earth; this isn't. */
export type SpotEnvironment = "open" | "built" | "wooded";

/**
 * Clutter allowance for built/wooded spots: a downtown block or a hardwood
 * canopy eats ~50 ft of sightline that bare-earth terrain cannot see. A spot
 * must clear terrain by MORE than this before we call its view anything but
 * blocked. (Owner ground truth 2026-07-02: Jones House "Limited" at +40 ft
 * over King Street's dirt was a fiction — the buildings are not dirt.)
 */
export const CLUTTER_PENALTY_M = 15;

/** Verdict for a KNOWN spot: bare-earth margins minus the clutter allowance. */
export function spotVerdict(r: { margin90M: number; margin150M: number }, env: SpotEnvironment = "open"): SightVerdict {
  const p = env === "open" ? 0 : CLUTTER_PENALTY_M;
  return verdictFromMargins(r.margin90M - p, r.margin150M - p);
}

/** Display margin for a known spot (typical shells), clutter applied. */
export function spotMarginM(r: { margin90M: number }, env: SpotEnvironment = "open"): number {
  return r.margin90M - (env === "open" ? 0 : CLUTTER_PENALTY_M);
}

/**
 * The published banding: clear needs typical bursts to clear by more than the
 * noise band; inside ±noise is marginal; blocked-at-90 but clear-at-150 means
 * you only see the big finale shells.
 */
export function verdictFromMargins(margin90: number, margin150: number): SightVerdict {
  if (margin90 >= MARGIN_NOISE_M) return "clear";
  if (margin90 > -MARGIN_NOISE_M) return "marginal";
  if (margin150 > 0) return "finale-only";
  return "blocked";
}
