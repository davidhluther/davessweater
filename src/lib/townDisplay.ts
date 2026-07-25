// Display helpers shared by the town-scoped surfaces (/weather/{slug},
// /right-wrong-ray/{slug}). The town forecast5 loader keys its per-source rows
// by the raw source id (e.g. "openmeteo", "raysweather"); these turn those ids
// into the same human labels the rest of the site uses.

import { FORECASTERS } from "@/lib/forecasters";

// Sources that live outside the FORECASTERS index (the graded incumbent, the
// Apple slot, and our own consensus row).
const EXTRA_LABELS: Record<string, string> = {
  raysweather: "Ray's Weather",
  apple_weather: "Apple Weather",
  composite: "Dave's Sweater Index",
  openmeteo: "Open-Meteo",
};

export function sourceLabel(key: string): string {
  return FORECASTERS[key]?.label ?? EXTRA_LABELS[key] ?? key;
}

/** A source is free unless it's the one with a bill (Ray's). */
export function sourceIsFree(key: string): boolean {
  return key !== "raysweather";
}

const PRECIP_LABEL: Record<string, string> = {
  rain: "Rain", snow: "Snow", mixed: "Wintry mix", none: "No precip",
};

export function precipLabel(precip: string | null | undefined): string {
  if (!precip) return "—";
  return PRECIP_LABEL[precip] ?? precip;
}
