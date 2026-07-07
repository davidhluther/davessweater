// Day constants + wall-clock helpers shared across the planner engines. All
// times are local (America/New_York); the games run a fixed four-day window.
import type { GmhgEvent } from "@/lib/types";

export const GMHG_DAYS = {
  thu: "2026-07-09",
  fri: "2026-07-10",
  sat: "2026-07-11",
  sun: "2026-07-12",
} as const;

export type GmhgDayKey = keyof typeof GMHG_DAYS;

export const DAY_ORDER: string[] = [GMHG_DAYS.thu, GMHG_DAYS.fri, GMHG_DAYS.sat, GMHG_DAYS.sun];

export const DAY_LABEL: Record<string, string> = {
  [GMHG_DAYS.thu]: "Thursday",
  [GMHG_DAYS.fri]: "Friday",
  [GMHG_DAYS.sat]: "Saturday",
  [GMHG_DAYS.sun]: "Sunday",
};

export const DAY_SHORT: Record<string, string> = {
  [GMHG_DAYS.thu]: "Thu",
  [GMHG_DAYS.fri]: "Fri",
  [GMHG_DAYS.sat]: "Sat",
  [GMHG_DAYS.sun]: "Sun",
};

/** "HH:MM" (24h) → minutes since midnight. */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** minutes since midnight → "HH:MM" (24h, zero-padded). */
export function toHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** minutes since midnight → "8:46 PM". */
export function fmtClock(min: number): string {
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const h12 = ((h24 + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, "0")} ${h24 < 12 ? "AM" : "PM"}`;
}

/** "HH:MM" → "8:46 PM". */
export function fmtClockStr(hhmm: string): string {
  return fmtClock(toMinutes(hhmm));
}

/** Selectable events for one day, sorted by start time (stable on title). */
export function eventsForDay(events: GmhgEvent[], day: string): GmhgEvent[] {
  return events
    .filter((e) => e.day === day && e.selectable)
    .sort((a, b) => toMinutes(a.start) - toMinutes(b.start) || a.title.localeCompare(b.title));
}

/** A stable id for an event (dataset rows have no id of their own). */
export function eventId(e: GmhgEvent): string {
  return `${e.day}_${e.start}_${e.title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
