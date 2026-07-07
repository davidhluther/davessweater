// Tunable planner constants for the Grandfather Mountain Highland Games tool.
// Everything year- or estimate-specific lives here in one visible place so the
// 2027 re-verify (and any calibration) is a single-file edit, not a hunt. All
// drive/shuttle numbers are ESTIMATES — surfaced as guidance, never a promise.

import { GMHG_DAYS } from "@/lib/gmhg/schedule";

/** MacRae Meadows itself — the forecast + field anchor (NOT Boone's pipeline
 *  coords). Elevation is real (4301 ft); Open-Meteo's grid cell smooths terrain,
 *  so we frame temps as directional. Mirrors data/gmhg_events.json meta. */
export const MACRAE = { lat: 36.086254, lon: -81.849066, elevationM: 1311 } as const;

// ── Origins → lots: static drive-time estimates (minutes) ────────────────────
// v1 hand-estimates for the four staging origins the spec presets. No billed API
// per page load; labeled as estimates in the UI.
export type OriginKey = "boone" | "linville" | "banner-elk" | "sugar-mountain";

export const ORIGINS: { key: OriginKey; label: string }[] = [
  { key: "boone", label: "Boone" },
  { key: "linville", label: "Linville" },
  { key: "banner-elk", label: "Banner Elk" },
  { key: "sugar-mountain", label: "Sugar Mountain" },
];

// Lot names exactly as they appear in meta.logistics.lots_by_day.
export const LOT_SUGAR = "Sugar Mountain";
export const LOT_LINVILLE = "Linville";
export const LOT_AVERY = "Avery County High School";
export const LOT_MILLERS = "Millers Gap";
/** Wheelchair-accessible transport hubs (not in lots_by_day). */
export const LOT_NEWLAND = "Newland Elementary School";

/** driveMin[origin][lot] — rough minutes, round numbers, explicitly estimates. */
export const DRIVE_MIN: Record<OriginKey, Record<string, number>> = {
  boone: { [LOT_SUGAR]: 30, [LOT_LINVILLE]: 25, [LOT_AVERY]: 35, [LOT_MILLERS]: 38, [LOT_NEWLAND]: 35 },
  linville: { [LOT_SUGAR]: 12, [LOT_LINVILLE]: 3, [LOT_AVERY]: 12, [LOT_MILLERS]: 15, [LOT_NEWLAND]: 12 },
  "banner-elk": { [LOT_SUGAR]: 8, [LOT_LINVILLE]: 15, [LOT_AVERY]: 18, [LOT_MILLERS]: 20, [LOT_NEWLAND]: 18 },
  "sugar-mountain": { [LOT_SUGAR]: 4, [LOT_LINVILLE]: 12, [LOT_AVERY]: 15, [LOT_MILLERS]: 18, [LOT_NEWLAND]: 15 },
};

// ── Arrive-by buffers (minutes) ──────────────────────────────────────────────
export const SHUTTLE_LINE_BUFFER = 30;      // time in the shuttle queue at the lot
export const SHUTTLE_LINE_BUFFER_AM = 40;   // heavier Fri/Sat morning rush
export const SHUTTLE_RIDE = 20;             // lot → field ride (estimate)
export const WALK_BUFFER = 15;              // gate → your first event

// The dance platforms and review stand sit right at the main-field bleachers,
// so moving between them and the field is a short hop — and you can often watch
// both at once. This is the "field/bleachers area" walk (minutes).
export const FIELD_AREA_WALK = 5;

export const SHUTTLE_PRICE_USD = 10;        // per seat, round trip, CASH ONLY

// Days on which the AM shuttle rush applies (Fri/Sat full days).
export const HEAVY_AM_DAYS = new Set<string>([GMHG_DAYS.fri, GMHG_DAYS.sat]);

// ── Peak crowd windows (parsed) ──────────────────────────────────────────────
// The dataset lists these as prose; we encode the concrete windows the UX spec
// calls out (§8.3). A transition into one of these windows pays the 1.5× walk tax.
export interface PeakWindow { startMin: number; endMin: number; day: string | null }
const hm = (h: number, m = 0) => h * 60 + m;
export const PEAK_WINDOWS: PeakWindow[] = [
  { startMin: hm(11), endMin: hm(11, 30), day: null },            // opening/closing ceremonies
  { startMin: hm(17), endMin: hm(22), day: null },               // concert ingress after 5 PM
  { startMin: hm(13, 15), endMin: hm(14), day: GMHG_DAYS.sat },  // post-caber crush (Sat)
];
export const PEAK_MULTIPLIER = 1.5;
