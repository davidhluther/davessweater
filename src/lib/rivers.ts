// USGS river gauges, and the one rule about attaching one to a town.
//
// scripts/capture_river_gauges.py polls three public USGS gauges each morning
// into data/rivers/{date}.json. A gauge is a point on one stream, not a
// regional condition: the Watauga at Sugar Grove says nothing verifiable about
// the New River at Jefferson, and neither says anything about Boone.
//
// So the correspondence below is NAME-based, not distance-based: a town gets a
// river reading only when USGS itself names the gauge for that community. No
// nearest-gauge fallback, ever — the same no-borrowing rule that governs Ray's
// per-town stations (lib/towns.ts: "never borrowed") and that kept a neighbor's
// station off Seven Devils, Sugar Grove, and Wilkesboro. A town with no gauge
// of its own simply shows no river line.
//
// Consequence worth stating plainly: Boone has no gauge in this capture set, so
// the default widget embed carries no river reading. That is the honest answer,
// not a gap to paper over. Adding a Boone-area gauge is a capture-script change
// (verify the site is live and in Boone's own waters first), not a display one.

import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const DATA = join(process.cwd(), "data");

/** Gauges whose USGS site name IS a tracked town. Keys are town slugs. */
export const GAUGE_BY_TOWN: Record<string, { site: string; river: string }> = {
  // "Watauga River near Sugar Grove" — USGS 03479000.
  "sugar-grove": { site: "03479000", river: "Watauga River" },
  // "South Fork New River near Jefferson" — USGS 03161000.
  "jefferson": { site: "03161000", river: "South Fork New River" },
  // The third captured gauge, Wilson Creek at Adako (02140991), sits in
  // Caldwell County at a community we do not track. It maps to nobody.
};

export interface RiverReading {
  /** Display name of the stream, from the mapping above (not the site name,
   *  which reads "near Sugar Grove" and would be redundant on a town card). */
  river: string;
  /** Discharge in cubic feet per second. */
  cfs: number;
  /** Gauge height in feet, when the site reports it. */
  gageFt: number | null;
  /** ISO timestamp of the USGS observation itself. */
  observedAt: string;
}

interface RawReading {
  name?: string;
  streamflow_cfs?: number | null;
  gage_height_ft?: number | null;
  observed_at?: string;
}
export interface RiverDay {
  date: string;
  sites?: Record<string, string>;
  samples?: { at: string; readings?: Record<string, RawReading> }[];
}

/** A reading older than this is not "current flow" and is dropped rather than
 *  shown with a stale timestamp. Two days covers a missed daily capture. */
export const MAX_READING_AGE_MS = 48 * 60 * 60 * 1000;

/**
 * The newest usable observation for one gauge inside one day's file. Pure —
 * `now` is injected so the freshness window is testable. Returns null when the
 * gauge did not report, reported a non-numeric flow, or the reading is stale.
 */
export function latestReading(
  day: RiverDay | null,
  site: string,
  river: string,
  now: Date,
): RiverReading | null {
  const samples = day?.samples;
  if (!Array.isArray(samples)) return null;
  // Files append one sample per run, so walk backwards to the freshest.
  for (let i = samples.length - 1; i >= 0; i--) {
    const r = samples[i]?.readings?.[site];
    const cfs = r?.streamflow_cfs;
    if (typeof cfs !== "number" || !Number.isFinite(cfs)) continue;
    const observedAt = r?.observed_at ?? samples[i]?.at;
    if (!observedAt) continue;
    const t = Date.parse(observedAt);
    if (!Number.isFinite(t)) continue;
    const age = now.getTime() - t;
    if (age < 0 || age > MAX_READING_AGE_MS) continue;
    const gage = r?.gage_height_ft;
    return {
      river,
      cfs,
      gageFt: typeof gage === "number" && Number.isFinite(gage) ? gage : null,
      observedAt,
    };
  }
  return null;
}

/** "91 cfs" / "1,240 cfs" / "8.4 cfs" — precision that matches the magnitude. */
export function formatFlow(cfs: number): string {
  const rounded = cfs < 10 ? Math.round(cfs * 10) / 10 : Math.round(cfs);
  return `${rounded.toLocaleString("en-US")} cfs`;
}

/**
 * The town's own river reading, or null. Reads the newest committed
 * data/rivers/*.json — the same build-time-committed data the rest of the site
 * runs on, no live call.
 */
export async function getRiverForTown(slug: string, now: Date = new Date()): Promise<RiverReading | null> {
  const gauge = GAUGE_BY_TOWN[slug];
  if (!gauge) return null;
  const dir = join(DATA, "rivers");
  if (!existsSync(dir)) return null;
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  } catch {
    return null;
  }
  // Two files back covers a run that straddled midnight or a capture that
  // failed today; anything older is caught by the freshness window anyway.
  for (const file of files.slice(-2).reverse()) {
    let day: RiverDay | null = null;
    try {
      day = JSON.parse(await readFile(join(dir, file), "utf8")) as RiverDay;
    } catch {
      continue;
    }
    const reading = latestReading(day, gauge.site, gauge.river, now);
    if (reading) return reading;
  }
  return null;
}
