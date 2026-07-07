// Forecast to a readable packing note. Pure rules over a day's Open-Meteo daily
// summary. The client fetches the forecast at MacRae's coords and calls this;
// when the fetch is unusable we FAIL CLOSED to static guidance rather than show
// a blank or a stale forecast. Returns flowing prose, not choppy fragments.

export interface DayForecast {
  date: string;
  tempMaxF: number | null;
  tempMinF: number | null;
  precipProbMaxPct: number | null;
  uvIndexMax: number | null;
}

export const PRECIP_PROB_THRESHOLD = 30;   // % — "rain likely" above this
export const SWING_THRESHOLD_F = 15;       // high−low above this → layers
export const UV_HIGH_THRESHOLD = 6;        // WHO "high" UV band
export const EARLY_HOUR = 9;               // events before 9 AM …
export const LATE_HOUR = 18;               // … or after 6 PM → layers

export const ALWAYS_LINE = "Grandfather makes its own weather, so plan for it to change fast; it runs cooler and windier up here than down in the valley.";

export const STATIC_PACKING =
  "Pack warm layers, a raincoat or poncho (umbrellas are hopeless in the wind), and sunscreen and a hat for the high-elevation sun. " + ALWAYS_LINE;

/** Join clauses into "a, b, and c". */
function joinList(items: string[]): string {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/**
 * A readable packing sentence for one day. `hasEarlyOrLate` = any selected event
 * before 9 AM or after 6 PM (bookend chill). Returns static prose when the
 * forecast is missing or unusable.
 */
export function packingFor(fc: DayForecast | null, hasEarlyOrLate: boolean): string {
  if (!fc || (fc.tempMaxF === null && fc.precipProbMaxPct === null && fc.uvIndexMax === null)) {
    return STATIC_PACKING;
  }
  const clauses: string[] = [];

  if (fc.precipProbMaxPct !== null && fc.precipProbMaxPct > PRECIP_PROB_THRESHOLD) {
    clauses.push(`a raincoat or poncho, since rain looks likely (${Math.round(fc.precipProbMaxPct)}% chance) and umbrellas are hopeless in the wind`);
  }

  const swing = fc.tempMaxF !== null && fc.tempMinF !== null ? fc.tempMaxF - fc.tempMinF : null;
  if (swing !== null && swing > SWING_THRESHOLD_F) {
    clauses.push(`warm layers for the ${Math.round(swing)}°F swing between morning and afternoon`);
  } else if (hasEarlyOrLate) {
    clauses.push("warm layers for the early and late hours out of the sun");
  }

  if (fc.uvIndexMax !== null && fc.uvIndexMax >= UV_HIGH_THRESHOLD) {
    clauses.push(`sunscreen and a hat for the strong high-elevation sun (UV index ${Math.round(fc.uvIndexMax)})`);
  }

  const lead = clauses.length ? `Pack ${joinList(clauses)}. ` : "";
  return `${lead}${ALWAYS_LINE}`;
}
