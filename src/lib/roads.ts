import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

// Reads the committed road JSON the Python pipeline writes (scripts/roads.py,
// capture_roads.py, compare_roads.py). Same read-the-repo pattern as data.ts.
const DATA = join(process.cwd(), "data");

async function readJson<T>(path: string): Promise<T | null> {
  try { return JSON.parse(await readFile(path, "utf8")) as T; }
  catch { return null; }
}

// Ordinal severity, best -> worst. Mirrors LEVELS in scripts/roads.py.
export type RoadLevel = "Clear" | "Wet" | "Slushy" | "Icy" | "Hazardous";

export type RoadDay = { date: string; level: RoadLevel; reason: string; risk: number };

export type RoadsForecast = {
  generated_at: string;
  source: string;
  location: string;
  rubric: Record<string, number>;
  levels: RoadLevel[];
  days: RoadDay[];
};

export type RoadIncident = {
  road: string | null;
  description: string | null;
  type: string | null;
  subtype: string | null;
  closed: boolean;
  severity: string | null;
  county: string | null;
};

export type RoadConditionRow = {
  county: string | null;
  division: string | null;
  overall: string | null;
  interstates: string | null;
  us_nc_routes: string | null;
  secondary: string | null;
};

export type ParkwayAlert = {
  title: string | null;
  category: string | null;
  description: string | null;
  url: string | null;
};

export type RoadConditions = {
  fetched_at: string;
  date: string;
  source: string;
  fetch_ok: boolean;
  counties_tracked: string[];
  incidents: RoadIncident[];
  road_conditions: RoadConditionRow[];
  parkway_alerts: ParkwayAlert[];
  worst_actual_level: RoadLevel;
};

export type RoadScoreDay = {
  date: string;
  score: number;
  distance: number;
  forecast: RoadLevel;
  actual: RoadLevel;
};

export type RoadScores = {
  days: RoadScoreDay[];
  average: number | null;
  updated_at?: string;
};

export async function getRoadsForecast(): Promise<RoadsForecast | null> {
  return readJson<RoadsForecast>(join(DATA, "roads_forecast.json"));
}

export async function getRoadScores(): Promise<RoadScores | null> {
  return readJson<RoadScores>(join(DATA, "road_scores.json"));
}

export async function getLatestRoadConditions(): Promise<RoadConditions | null> {
  const dir = join(DATA, "road_conditions");
  if (!existsSync(dir)) return null;
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  return files.length ? readJson<RoadConditions>(join(dir, files[files.length - 1])) : null;
}

// Render-time verdict -> label + tone. `tone` drives the on-page color class.
const TONES: Record<RoadLevel, "good" | "warn" | "bad"> = {
  Clear: "good",
  Wet: "warn",
  Slushy: "warn",
  Icy: "bad",
  Hazardous: "bad",
};

export function levelDisplay(level: RoadLevel): { label: RoadLevel; tone: "good" | "warn" | "bad" } {
  return { label: level, tone: TONES[level] };
}

// A capture is "fresh enough to display" only if it fetched today or yesterday
// and the fetch actually succeeded. Older/failed captures gate the live block
// off rather than showing stale road state as current.
export function conditionsAreFresh(conditions: RoadConditions | null, today: Date = new Date()): boolean {
  if (!conditions?.fetched_at || !conditions.fetch_ok) return false;
  const fetched = new Date(conditions.fetched_at);
  if (Number.isNaN(fetched.getTime())) return false;
  const ageHours = (today.getTime() - fetched.getTime()) / 36e5;
  return ageHours >= 0 && ageHours <= 48;
}
