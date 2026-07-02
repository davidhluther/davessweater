// Solar + lunar timing for a point on Earth — the computational spine of the
// /fireworks page today and the terrain-adjusted /sunset page later.
//
// Conventions (standard almanac, matching NOAA/timeanddate):
//   sunset            = upper limb at the refracted sea-level horizon (-0.833°)
//   civil dusk end    = sun 6° below the horizon ("dark enough" for fireworks)
//   nautical dusk end = sun 12° below the horizon ("fully dark" to the eye)
// All instants are UTC Dates; format them into a zone with fmtTime(). Passing
// elevationM applies suncalc's horizon-dip correction, which assumes the
// horizon sits at sea level — usually wrong in mountain terrain (Boone's
// horizon is ridgeline), so callers here pass 0 and disclose the convention.
// The terrain-adjusted horizon model is the future /sunset project.
// suncalc ships as UMD/CJS; the default-import shape differs between vitest's
// node ESM interop and Next's bundler, so normalize both.
import * as suncalcModule from "suncalc";
type SunCalcApi = typeof import("suncalc");
const SunCalc: SunCalcApi =
  (suncalcModule as { default?: SunCalcApi }).default ?? (suncalcModule as SunCalcApi);
// @types/suncalc omits getMoonTimes' documented 4th param (inUTC); the runtime has it.
const getMoonTimes = SunCalc.getMoonTimes as (
  date: Date, latitude: number, longitude: number, inUTC?: boolean,
) => ReturnType<SunCalcApi["getMoonTimes"]>;

export const NY_TZ = "America/New_York";

export type MoonPhaseName =
  | "new moon" | "waxing crescent" | "first quarter" | "waxing gibbous"
  | "full moon" | "waning gibbous" | "last quarter" | "waning crescent";

export interface SolarQuery {
  lat: number;
  lon: number;
  /** Observer height in meters for horizon-dip; see header note. Default 0. */
  elevationM?: number;
  /** Local calendar date "YYYY-MM-DD", interpreted in `tz`. */
  date: string;
  /** IANA zone, e.g. "America/New_York". */
  tz: string;
}

export interface SolarPacket {
  query: Required<SolarQuery>;
  /** Null when the event doesn't occur that day (polar latitudes). */
  sunset: Date | null;
  civilDuskEnd: Date | null;
  nauticalDuskEnd: Date | null;
  astroDuskEnd: Date | null;
  /** First moonrise/moonset falling within the local calendar day. */
  moonrise: Date | null;
  moonset: Date | null;
  moon: {
    /** Illuminated fraction 0..1, evaluated at civil dusk (or local noon). */
    fraction: number;
    /** Phase 0..1: 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter. */
    phase: number;
    name: MoonPhaseName;
  };
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const dtfCache = new Map<string, Intl.DateTimeFormat>();
function offsetFormatter(tz: string): Intl.DateTimeFormat {
  let f = dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    dtfCache.set(tz, f);
  }
  return f;
}

/** Zone offset (ms east of UTC) in effect at a UTC instant. */
export function tzOffsetMs(utcMs: number, tz: string): number {
  const parts: Record<string, string> = {};
  for (const { type, value } of offsetFormatter(tz).formatToParts(new Date(utcMs))) {
    parts[type] = value;
  }
  const asUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second),
  );
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** UTC instant (ms) of a wall-clock time in a zone. Two-pass around DST. */
export function zonedTimeToUtcMs(date: string, hour: number, minute: number, tz: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const asIfUtc = Date.UTC(y, m - 1, d, hour, minute, 0, 0);
  let utc = asIfUtc - tzOffsetMs(asIfUtc, tz);
  utc = asIfUtc - tzOffsetMs(utc, tz);
  return utc;
}

/** Calendar date "YYYY-MM-DD" of an instant, in a zone. */
export function localDateString(tz: string, at: Date = new Date()): string {
  const parts: Record<string, string> = {};
  for (const { type, value } of offsetFormatter(tz).formatToParts(at)) parts[type] = value;
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function validDate(d: Date | null | undefined): Date | null {
  return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
}

export function moonPhaseName(phase: number): MoonPhaseName {
  const p = ((phase % 1) + 1) % 1;
  const near = (x: number) => Math.abs(p - x) < 0.017 || Math.abs(p - x) > 1 - 0.017;
  if (near(0)) return "new moon";
  if (near(0.25)) return "first quarter";
  if (near(0.5)) return "full moon";
  if (near(0.75)) return "last quarter";
  if (p < 0.25) return "waxing crescent";
  if (p < 0.5) return "waxing gibbous";
  if (p < 0.75) return "waning gibbous";
  return "waning crescent";
}

/** The full solar packet for one local calendar day at one place. */
export function solarPacket(q: SolarQuery): SolarPacket {
  const { lat, lon, date, tz } = q;
  const elevationM = q.elevationM ?? 0;
  const dayStart = zonedTimeToUtcMs(date, 0, 0, tz);
  const dayEnd = zonedTimeToUtcMs(addDays(date, 1), 0, 0, tz);
  const noon = zonedTimeToUtcMs(date, 12, 0, tz);

  const t = SunCalc.getTimes(new Date(noon), lat, lon, elevationM);
  const sunset = validDate(t.sunset);
  const civilDuskEnd = validDate(t.dusk);
  const nauticalDuskEnd = validDate(t.nauticalDusk);
  const astroDuskEnd = validDate(t.night);

  // getMoonTimes scans one UTC calendar day; a local day can straddle up to
  // three of them, so scan all three and keep events inside the local day.
  const rises: Date[] = [];
  const sets: Date[] = [];
  for (const offset of [0, DAY, 2 * DAY]) {
    const mt = getMoonTimes(new Date(dayStart - DAY + offset), lat, lon, true);
    const r = validDate(mt.rise);
    const s = validDate(mt.set);
    if (r) rises.push(r);
    if (s) sets.push(s);
  }
  const inDay = (d: Date) => d.getTime() >= dayStart && d.getTime() < dayEnd;
  const byTime = (a: Date, b: Date) => a.getTime() - b.getTime();
  const moonrise = rises.filter(inDay).sort(byTime)[0] ?? null;
  const moonset = sets.filter(inDay).sort(byTime)[0] ?? null;

  const illum = SunCalc.getMoonIllumination(civilDuskEnd ?? new Date(noon));
  return {
    query: { lat, lon, elevationM, date, tz },
    sunset, civilDuskEnd, nauticalDuskEnd, astroDuskEnd,
    moonrise, moonset,
    moon: { fraction: illum.fraction, phase: illum.phase, name: moonPhaseName(illum.phase) },
  };
}

/** One point of a terrain horizon profile (from scripts/compute_terrain.mjs). */
export interface HorizonPoint {
  az: number; // compass degrees
  deg: number; // elevation angle of the terrain at that azimuth
}

/**
 * When the sun drops behind the local terrain — the "last direct sun" moment,
 * distinct from astronomical sunset (ridges steal minutes) and from civil
 * dusk (sky-scatter, which terrain barely touches).
 *
 * NOTE: this suncalc build returns getPosition() in DEGREES with azimuth from
 * NORTH (verified empirically; the classic API was radians-from-south). The
 * flat-horizon test in solar.test.ts guards against a dependency update
 * silently flipping the convention.
 */
export function lastDirectSun(
  horizon: HorizonPoint[], date: string, tz: string, lat: number, lon: number,
): Date | null {
  if (horizon.length < 2) return null;
  const first = horizon[0].az;
  const last = horizon[horizon.length - 1].az;
  const hz = (az: number): number => {
    const c = Math.min(last, Math.max(first, az));
    const i = Math.min(horizon.length - 2, Math.max(0, Math.floor(c - first)));
    const a = horizon[i];
    const b = horizon[i + 1];
    return a.deg + ((b.deg - a.deg) * (c - a.az)) / (b.az - a.az || 1);
  };
  const start = zonedTimeToUtcMs(date, 15, 0, tz); // scan from 3 PM local
  for (let m = 0; m <= 7 * 60; m++) {
    const t = new Date(start + m * 60_000);
    const pos = SunCalc.getPosition(t, lat, lon);
    const alt = pos.altitude;
    const az = ((pos.azimuth % 360) + 360) % 360;
    if (az < first || az > last) continue;
    if (alt <= hz(az)) return t;
    if (alt < -1.5) return null; // set below even an open horizon
  }
  return null;
}

/** "8:46 PM" — the one rendering path for every time on the page. */
export function fmtTime(d: Date | null, tz: string): string | null {
  if (!d) return null;
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(d);
}

export function minutesBetween(a: Date | null, b: Date | null): number | null {
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 60_000);
}
