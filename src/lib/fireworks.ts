// Fireworks Forecast logic for /fireworks: the published verdict rubric and
// the aggregation that applies it to the evening hours captured by
// scripts/capture_fireworks_forecast.py. The thresholds below are rendered
// verbatim on the page — the rubric users read IS the object the code runs.
// Venue facts live in fireworksVenues.ts; solar math in solar.ts.

export interface FireworksHour {
  time: string; // local NY ISO, "2026-07-04T20:00"
  cloud_low: number | null;
  cloud_mid: number | null;
  cloud_high: number | null;
  precip_prob: number | null;
  precip_in: number | null;
  temp_f: number | null;
  dewpoint_f: number | null;
  wind_mph: number | null;
  wind_dir_deg: number | null;
  visibility_m: number | null;
}

export interface FireworksForecastFile {
  schema_version: number;
  fetched_at: string;
  provider: string;
  venues: Record<string, { lat: number; lon: number; nights: Record<string, FireworksHour[]> }>;
}

/** The show window we judge: hours starting 8, 9, and 10 PM local. */
export const SHOW_WINDOW_HOURS = [20, 21, 22] as const;

/**
 * The verdict rubric, published on the page exactly as written here.
 * "avg" = mean over the show window; "min" = worst hour in the window.
 */
export const RUBRIC = {
  obstructed: {
    cloudLowAvgPct: 60, // a low deck at burst height swallows the show
    visibilityMinMi: 2, // fog on the field
    precipProbAvgPct: 60, // rain both likely…
    precipTotalIn: 0.05, // …and material
  },
  iffy: {
    cloudLowAvgPct: 30,
    cloudMidAvgPct: 70,
    precipProbAvgPct: 35,
    spreadMinF: 3, // temp−dew point pinch = valley-fog setup
    visibilityMinMi: 5,
  },
  /** Forecast older than this fails closed to "unavailable". */
  staleAfterHours: 36,
} as const;

export type Verdict = "clear" | "iffy" | "obstructed" | "unavailable";

export interface WindowStats {
  hoursUsed: number;
  cloudLowAvg: number | null;
  cloudMidAvg: number | null;
  cloudHighAvg: number | null;
  precipProbAvg: number | null;
  precipTotalIn: number | null;
  spreadMinF: number | null;
  visibilityMinMi: number | null;
  windAvgMph: number | null;
  windDirDeg: number | null;
  windCompass: string | null;
}

export interface NightOutlook {
  verdict: Verdict;
  reasons: string[];
  stats: WindowStats | null;
}

const M_PER_MILE = 1609.344;

function avg(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}
function min(xs: number[]): number | null {
  return xs.length ? Math.min(...xs) : null;
}
function present<T>(xs: (T | null | undefined)[]): T[] {
  return xs.filter((x): x is T => x !== null && x !== undefined);
}

/** Speed-weighted circular mean of wind direction (deg the wind comes FROM). */
export function windVectorMean(hours: { wind_mph: number | null; wind_dir_deg: number | null }[]):
  { dirDeg: number | null; avgMph: number | null } {
  let x = 0, y = 0, n = 0, speedSum = 0;
  for (const h of hours) {
    if (h.wind_dir_deg === null || h.wind_mph === null) continue;
    const rad = (h.wind_dir_deg * Math.PI) / 180;
    x += Math.sin(rad) * h.wind_mph;
    y += Math.cos(rad) * h.wind_mph;
    speedSum += h.wind_mph;
    n++;
  }
  if (!n) return { dirDeg: null, avgMph: null };
  const avgMph = speedSum / n;
  if (x === 0 && y === 0) return { dirDeg: null, avgMph };
  const deg = ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
  return { dirDeg: deg, avgMph };
}

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
export function compass16(deg: number): string {
  return COMPASS[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
}

/** Opposite compass point — where the smoke goes (downwind). */
export function downwindCompass(fromDeg: number): string {
  return compass16(fromDeg + 180);
}

export function windowStats(hours: FireworksHour[]): WindowStats | null {
  const window = hours.filter((h) => {
    const hr = Number(h.time.slice(11, 13));
    return (SHOW_WINDOW_HOURS as readonly number[]).includes(hr);
  });
  if (!window.length) return null;
  const spread = window
    .filter((h) => h.temp_f !== null && h.dewpoint_f !== null)
    .map((h) => (h.temp_f as number) - (h.dewpoint_f as number));
  const visMi = present(window.map((h) => h.visibility_m)).map((m) => m / M_PER_MILE);
  const precip = present(window.map((h) => h.precip_in));
  const wind = windVectorMean(window);
  return {
    hoursUsed: window.length,
    cloudLowAvg: avg(present(window.map((h) => h.cloud_low))),
    cloudMidAvg: avg(present(window.map((h) => h.cloud_mid))),
    cloudHighAvg: avg(present(window.map((h) => h.cloud_high))),
    precipProbAvg: avg(present(window.map((h) => h.precip_prob))),
    precipTotalIn: precip.length ? precip.reduce((a, b) => a + b, 0) : null,
    spreadMinF: min(spread),
    visibilityMinMi: min(visMi),
    windAvgMph: wind.avgMph,
    windDirDeg: wind.dirDeg,
    windCompass: wind.dirDeg === null ? null : compass16(wind.dirDeg),
  };
}

const r1 = (x: number) => Math.round(x * 10) / 10;

/** Apply the published rubric to a night's window stats. */
export function nightVerdict(stats: WindowStats | null): NightOutlook {
  // Low cloud is the core mountain-show signal; without it we don't guess.
  if (!stats || stats.cloudLowAvg === null) {
    return { verdict: "unavailable", reasons: [], stats: stats ?? null };
  }
  const R = RUBRIC;
  const reasons: string[] = [];

  // Reason strings render directly on the outlook cards: full sentences,
  // condition → number → consequence, no rubric jargon (thresholds live in
  // the methodology section).
  if (stats.cloudLowAvg > R.obstructed.cloudLowAvgPct) {
    reasons.push(`Low cloud averages ${Math.round(stats.cloudLowAvg)}% over the show window; likely socked in.`);
  }
  if (stats.visibilityMinMi !== null && stats.visibilityMinMi < R.obstructed.visibilityMinMi) {
    reasons.push(`Visibility drops to ${r1(stats.visibilityMinMi)} mi; fog on the field.`);
  }
  if (
    stats.precipProbAvg !== null && stats.precipTotalIn !== null &&
    stats.precipProbAvg >= R.obstructed.precipProbAvgPct && stats.precipTotalIn >= R.obstructed.precipTotalIn
  ) {
    reasons.push(`Rain is likely (${Math.round(stats.precipProbAvg)}%) and material (${r1(stats.precipTotalIn)}″).`);
  }
  if (reasons.length) return { verdict: "obstructed", reasons, stats };

  if (stats.cloudLowAvg > R.iffy.cloudLowAvgPct) {
    reasons.push(`Low cloud averages ${Math.round(stats.cloudLowAvg)}%; patchy cover likely.`);
  }
  if (stats.cloudMidAvg !== null && stats.cloudMidAvg > R.iffy.cloudMidAvgPct) {
    reasons.push(`A ${Math.round(stats.cloudMidAvg)}% mid-level deck may mute the high bursts.`);
  }
  if (stats.precipProbAvg !== null && stats.precipProbAvg >= R.iffy.precipProbAvgPct) {
    reasons.push(`Rain chance averages ${Math.round(stats.precipProbAvg)}%.`);
  }
  if (stats.spreadMinF !== null && stats.spreadMinF < R.iffy.spreadMinF) {
    reasons.push(`Temp and dew point pinch to ${r1(stats.spreadMinF)}°F, the valley-fog setup.`);
  }
  if (stats.visibilityMinMi !== null && stats.visibilityMinMi < R.iffy.visibilityMinMi) {
    reasons.push(`Visibility dips to ${r1(stats.visibilityMinMi)} mi.`);
  }
  if (reasons.length) return { verdict: "iffy", reasons, stats };

  return { verdict: "clear", reasons: [], stats };
}

/** Fail closed: a forecast older than the rubric's staleness bound is no forecast. */
export function isStale(fetchedAtIso: string, now: Date = new Date()): boolean {
  const fetched = Date.parse(fetchedAtIso);
  if (Number.isNaN(fetched)) return true;
  return now.getTime() - fetched > RUBRIC.staleAfterHours * 3_600_000;
}

/** Page states, all built now; flips are driven by the local build date. */
export type PageMode = "preview" | "tonight" | "archive";
export const SEASON = { year: 2026, tonightFrom: "2026-07-03", lastShow: "2026-07-04" } as const;

export function pageMode(todayLocal: string): PageMode {
  if (todayLocal > SEASON.lastShow) return "archive";
  if (todayLocal >= SEASON.tonightFrom) return "tonight";
  return "preview";
}
