// Walk-time + transition feasibility — the single source of truth for both the
// timeline conflict badges (Part 8) and the path-map leg colors (Part 9).
//
// Model (reproduces the dataset's worked example exactly): the cluster matrix in
// meta.walk_times is the BASE time with the around-oval and south-tent-maze
// penalties already baked in — the dataset says so ("base center-south 14 min +
// south tent-maze already included"). So a cross-field transition uses the matrix
// value directly; a transition whose destination falls in a peak window pays the
// 1.5× crowd tax on top. Same zone = the flat 3-min hop.
//
//   Prof. Caber Toss (center, 13:15) → Gaelic Tent (south, 13:30):
//     base center-south 14 → post-caber Sat peak ×1.5 → 21 min ("allow ~20").
//     You have 15 min, so it won't fit. Matches the dataset.

import type { GmhgCluster, GmhgEvent, GmhgWalkTimes, GmhgZone } from "@/lib/types";
import { FIELD_AREA_WALK, PEAK_MULTIPLIER, PEAK_WINDOWS } from "@/lib/gmhg/constants";
import { toMinutes } from "@/lib/gmhg/schedule";

export type TransitionStatus = "ok" | "tight" | "wontfit" | "overlap" | "covisible" | "offsite";

// The dance platforms and review stand sit at the main-field bleachers, so they
// and the center-field zones form one "field/bleachers area": short walks
// between them, and things happening in them at the same time can be watched
// together (e.g. the dance stage while athletics run on the field).
const FIELD_AREA_EXTRA = new Set(["dance", "review_stand"]);

// The Celtic Groves and Alex Beaton stage share the music_groves zone but sit
// far apart (Grove #1 top-left, Grove #2 top-right, Alex Beaton far east). Split
// them into distinct effective zones, all in the north cluster, so walk time and
// co-visibility treat them as the separate places they are.
const GROVE_VENUE_ZONE: Record<string, string> = {
  "Grove I": "grove1",
  "Grove II": "grove2",
  "Alex Beaton Stage": "alexbeaton",
};
const SYNTHETIC_CLUSTER: Record<string, GmhgCluster> = {
  grove1: "north", grove2: "north", alexbeaton: "north",
};

/** Resolve an event to its effective zone, splitting the shared grove zone by venue. */
export function effectiveZone(e: { zone: string | null; venue?: string }): string | null {
  if (e.zone === "music_groves" && e.venue && GROVE_VENUE_ZONE[e.venue]) return GROVE_VENUE_ZONE[e.venue];
  return e.zone;
}

export function inFieldArea(zone: string | null, zones: Record<string, GmhgZone>): boolean {
  if (!zone) return false;
  return clusterFor(zone, zones) === "center" || FIELD_AREA_EXTRA.has(zone);
}

/** Can you take in both zones at once (same spot, or both in the field/bleachers area)? */
export function coVisible(a: string | null, b: string | null, zones: Record<string, GmhgZone>): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  return inFieldArea(a, zones) && inFieldArea(b, zones);
}

export interface Transition {
  fromId: string;
  toId: string;
  gapMin: number;
  /** On-field walk estimate in minutes; null when a leg touches an off-field zone. */
  walkMin: number | null;
  peak: boolean;
  status: TransitionStatus;
}

/** Minutes of slack (gap − walk) below which a transition is "tight" not "ok". */
export const TIGHT_SLACK_MIN = 8;

export function clusterFor(zone: string | null, zones: Record<string, GmhgZone>): GmhgCluster | null {
  if (!zone) return null;
  return SYNTHETIC_CLUSTER[zone] ?? zones[zone]?.cluster ?? null;
}

/** Is `min` (minutes since midnight) on `day` inside any peak crowd window? */
export function inPeakWindow(min: number, day: string): boolean {
  return PEAK_WINDOWS.some(
    (w) => (w.day === null || w.day === day) && min >= w.startMin && min < w.endMin,
  );
}

/**
 * On-field walk estimate between two zones for a transition ARRIVING at
 * `arriveMin` on `day`. Returns null when either endpoint is off-field
 * (offsite / unplaced) — there is no on-meadow leg to estimate.
 */
export function walkMinutes(
  fromZone: string | null,
  toZone: string | null,
  arriveMin: number,
  day: string,
  wt: GmhgWalkTimes,
  zones: Record<string, GmhgZone>,
): number | null {
  const ca = clusterFor(fromZone, zones);
  const cb = clusterFor(toZone, zones);
  if (!ca || !cb || ca === "offsite" || cb === "offsite") return null;

  let base: number;
  if (fromZone === toZone) {
    base = wt.same_zone;
  } else if (inFieldArea(fromZone, zones) && inFieldArea(toZone, zones)) {
    // Field/bleachers area — a short hop, not a cross-field trek.
    base = FIELD_AREA_WALK;
  } else {
    base =
      wt.matrix_by_cluster_min[`${ca}-${cb}`] ??
      wt.matrix_by_cluster_min[`${cb}-${ca}`] ??
      wt.within_cluster;
  }
  const peak = inPeakWindow(arriveMin, day);
  return Math.ceil(base * (peak ? PEAK_MULTIPLIER : 1));
}

/**
 * Feasibility of going from one selected event to the next (ordered by start).
 * `gap` is start-to-start, matching the dataset's worked example.
 */
export function transitionVerdict(
  from: GmhgEvent,
  to: GmhgEvent,
  wt: GmhgWalkTimes,
  zones: Record<string, GmhgZone>,
  ids: { from: string; to: string },
): Transition {
  const fromZone = effectiveZone(from);
  const toZone = effectiveZone(to);
  const gapMin = toMinutes(to.start) - toMinutes(from.start);
  const arrive = toMinutes(to.start);
  const peak = inPeakWindow(arrive, to.day);

  // Same start time. Usually you cannot be in two places at once — unless both
  // sit in the field/bleachers area, where you can take in both at once.
  if (gapMin <= 0) {
    const status: TransitionStatus = coVisible(fromZone, toZone, zones) ? "covisible" : "overlap";
    return { fromId: ids.from, toId: ids.to, gapMin, walkMin: null, peak, status };
  }

  const walkMin = walkMinutes(fromZone, toZone, arrive, to.day, wt, zones);
  if (walkMin === null) {
    // An off-field endpoint (e.g. Best Western whisky) — no on-meadow walk to judge.
    return { fromId: ids.from, toId: ids.to, gapMin, walkMin: null, peak, status: "offsite" };
  }

  let status: TransitionStatus;
  if (gapMin < walkMin) status = "wontfit";
  else if (gapMin - walkMin <= TIGHT_SLACK_MIN) status = "tight";
  else status = "ok";

  return { fromId: ids.from, toId: ids.to, gapMin, walkMin, peak, status };
}
