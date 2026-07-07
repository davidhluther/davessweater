// Arrive-by, correct-lot, and cash-cost logic. All outputs are GUIDANCE, not
// promises — drive/shuttle numbers are estimates (see constants.ts). The one
// non-negotiable fact this encodes: the lot that runs changes by day, and the
// Fri/Sat concert cutover (drive up after 5 PM, no shuttle) is a different mode
// entirely — the #1 point of public confusion.

import type { GmhgEvent, GmhgLogistics } from "@/lib/types";
import {
  DRIVE_MIN, HEAVY_AM_DAYS, LOT_AVERY, LOT_NEWLAND, ORIGINS,
  SHUTTLE_LINE_BUFFER, SHUTTLE_LINE_BUFFER_AM, SHUTTLE_PRICE_USD, SHUTTLE_RIDE,
  WALK_BUFFER, type OriginKey,
} from "@/lib/gmhg/constants";
import { GMHG_DAYS, toMinutes } from "@/lib/gmhg/schedule";

export interface PlanInput {
  day: string;
  events: GmhgEvent[];      // the user's SELECTED events for this day
  origin: OriginKey;
  accessible: boolean;
}

export interface DayPlan {
  day: string;
  /** True when every selected event that day is a concert → drive-up mode. */
  concertOnly: boolean;
  earliestStartMin: number | null;
  /** Chosen lot (null in concert-only mode — you drive to the Meadow). */
  lot: string | null;
  alternateLots: string[];
  driveMin: number | null;
  shuttleLineBuffer: number;
  /** Suggested departure, minutes since midnight (null in concert-only mode). */
  leaveByMin: number | null;
  /** True if this day needs a paid shuttle (drives cost + cash total). */
  needsShuttle: boolean;
}

/** A day is concert-only when it has selections and all of them are concerts. */
export function isConcertOnly(events: GmhgEvent[]): boolean {
  return events.length > 0 && events.every((e) => e.category === "concert");
}

/** The lots that actually run on `day`, honoring the accessibility override. */
export function availableLots(day: string, logistics: GmhgLogistics, accessible: boolean): string[] {
  if (accessible) {
    // Newland Elementary Fri/Sat/Sun; Avery County HS on Thu.
    return [day === GMHG_DAYS.thu ? LOT_AVERY : LOT_NEWLAND];
  }
  return logistics.lots_by_day[day] ?? [];
}

/** Nearest running lot to the origin, plus the rest as alternates. */
export function pickLot(
  day: string,
  origin: OriginKey,
  logistics: GmhgLogistics,
  accessible: boolean,
): { lot: string | null; alternates: string[] } {
  const lots = availableLots(day, logistics, accessible);
  if (lots.length === 0) return { lot: null, alternates: [] };
  const ranked = [...lots].sort(
    (a, b) => (DRIVE_MIN[origin][a] ?? 999) - (DRIVE_MIN[origin][b] ?? 999),
  );
  return { lot: ranked[0], alternates: ranked.slice(1) };
}

export function buildDayPlan(input: PlanInput, logistics: GmhgLogistics): DayPlan {
  const { day, events, origin, accessible } = input;
  const starts = events.map((e) => toMinutes(e.start));
  const earliestStartMin = starts.length ? Math.min(...starts) : null;
  const concertOnly = isConcertOnly(events);

  if (concertOnly || earliestStartMin === null) {
    // Concerts: general public drives up onto MacRae Meadows after 5 PM, gates at
    // 6 PM. No lot, no shuttle, no cash-for-shuttle.
    return {
      day, concertOnly, earliestStartMin,
      lot: null, alternateLots: [], driveMin: null,
      shuttleLineBuffer: 0, leaveByMin: null, needsShuttle: false,
    };
  }

  const { lot, alternates } = pickLot(day, origin, logistics, accessible);
  const driveMin = lot ? DRIVE_MIN[origin][lot] ?? null : null;
  const lineBuffer = HEAVY_AM_DAYS.has(day) ? SHUTTLE_LINE_BUFFER_AM : SHUTTLE_LINE_BUFFER;
  const leaveByMin =
    driveMin === null
      ? null
      : earliestStartMin - driveMin - lineBuffer - SHUTTLE_RIDE - WALK_BUFFER;

  return {
    day, concertOnly, earliestStartMin,
    lot, alternateLots: alternates, driveMin,
    shuttleLineBuffer: lineBuffer, leaveByMin, needsShuttle: true,
  };
}

export interface CostSummary {
  partySize: number;
  shuttleDays: number;  // distinct days needing a shuttle
  totalUsd: number;     // 10 × party × shuttleDays
}

/** Cash needed for shuttles across the selected plan (concert-only days excluded). */
export function shuttleCost(dayPlans: DayPlan[], partySize: number): CostSummary {
  const shuttleDays = dayPlans.filter((p) => p.needsShuttle).length;
  return {
    partySize,
    shuttleDays,
    totalUsd: SHUTTLE_PRICE_USD * Math.max(1, partySize) * shuttleDays,
  };
}

export const ORIGIN_LABELS: Record<OriginKey, string> = Object.fromEntries(
  ORIGINS.map((o) => [o.key, o.label]),
) as Record<OriginKey, string>;
