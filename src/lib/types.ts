export interface Actuals {
  date?: string; location?: string;
  high_f?: number; low_f?: number;
  precip_in?: number; snow_in?: number;
  wind_mph?: number; gust_mph?: number;
  weather_code?: number; conditions?: string; category?: string;
}

export interface SweaterWeather {
  answer?: string; detail?: string; layers?: string;
  emoji?: string; sweater_count?: number;
}

export interface Prediction {
  high_f?: number; low_f?: number; precip_in?: number; snow_in?: number;
  precip_prob?: number; weather_code?: number; conditions?: string;
  category?: string; wind_mph?: number;
  today_high_f?: number; tonight_low_f?: number; daytime_desc?: string; rainfall_in?: number;
}

export type CoverageField = "high_temp" | "low_temp" | "wind" | "precip_type" | "precip_amount";

export interface CoverageStat { provided: number; days: number; }

export interface ScoreBreakdownField {
  points: number | null;
  max: number;
  scored?: boolean;
  predicted?: number | string | null;
  actual?: number | string | null;
  error?: number | null;
  unit?: string;
}
export interface Score {
  score: number;
  grade: { verdict: string; ray_count: number };
  breakdown: Record<string, ScoreBreakdownField>;
}
export interface SourceEntry { prediction: Prediction; score: Score; }

export interface Comparison {
  date: string;
  generated_at?: string;
  actuals: Actuals;
  sweater_weather: SweaterWeather;
  // Keyed by source id. The original three (openmeteo/raysweather/apple_weather)
  // plus the expanded roster (nws, metno, openweathermap, weatherapi,
  // visualcrossing, tomorrowio, googleweather) — see src/lib/forecasters.ts.
  sources: Partial<Record<string, SourceEntry>>;
}

export interface SourceTotals { right: number; wrong: number; meh: number; total_score: number; days: number; }
export interface Scores {
  entries: Array<Record<string, unknown>>;
  totals: Partial<Record<string, SourceTotals>>;
  coverage?: Partial<Record<string, Partial<Record<CoverageField, CoverageStat>>>>;
}

export interface ForecastDisplay {
  label: string;
  high_f: number | null;
  low_f: number | null;
  wind: string | null;
  precip_type: string | null;
}
export interface LatestForecasts {
  date: string;
  generated_at?: string;
  sources: Record<string, ForecastDisplay>;
}

export interface BlogPost {
  title: string; link: string; date?: string; summary?: string; content?: string;
  // Native posts (src/content/posts/*.md) set these; Substack-mirrored feed posts omit them.
  slug?: string; category?: "articles" | "news"; metaTitle?: string; metaDescription?: string;
  // Extracted from a native post's "Frequently asked questions" section → FAQPage JSON-LD.
  faqs?: { q: string; a: string }[];
}
export interface Video { title: string; link: string; date: string; thumb?: string; }
export interface Product { name: string; link: string; image?: string; price?: string; id?: string; }

// ── Grandfather Mountain Highland Games planner (data/gmhg_events.json) ──
// A self-contained events dataset for the /reports/…highland-games planner. The
// shape mirrors the authoritative JSON the owner captured from gmhg.org.
export type GmhgCluster = "center" | "north" | "south" | "offsite";

export interface GmhgZone {
  description: string;
  cluster: GmhgCluster;
  pos: string;
  /** Schematic position in a 0–100 field space; null for off-mountain zones. */
  xy: [number, number] | null;
}

export interface GmhgCongestion {
  peak_crowd_multiplier: number;
  peak_windows: string[];
  south_tent_maze_penalty_min: number;
  around_oval_penalty_min: number;
  note: string;
}

export interface GmhgWalkTimes {
  note: string;
  same_zone: number;
  within_cluster: number;
  congestion_factors: GmhgCongestion;
  /** Base minutes per cluster pair, e.g. "center-south": 14 (penalties baked in). */
  matrix_by_cluster_min: Record<string, number>;
  to_from_shuttle_gate_min: number;
  worked_example: string;
}

export interface GmhgLogistics {
  shuttle_price: string;
  no_atm: boolean;
  lots_by_day: Record<string, string[]>;
  shuttle_hours: Record<string, string>;
  concert_nights: string;
  accessible_transport: Record<string, string>;
  lots: Record<string, string>;
  pets: string;
  mobility_onfield: string;
  office_phone: string;
  tickets_url: string;
}

export interface GmhgForecastLocation {
  name: string;
  latitude: number;
  longitude: number;
  elevation_ft: number;
  elevation_m: number;
  open_meteo_note?: string;
  landmark_cross_check?: string;
  coordinate_source?: string;
  prior_coordinate_note?: string;
}

export interface GmhgMeta {
  event: string;
  dates: string;
  venue: string;
  timezone: string;
  utc_offset_july: string;
  source?: string;
  source_of_truth_note?: string;
  zones: Record<string, GmhgZone>;
  logistics: GmhgLogistics;
  walk_times: GmhgWalkTimes;
  forecast_location: GmhgForecastLocation;
}

export interface GmhgEvent {
  day: string;        // "YYYY-MM-DD"
  start: string;      // "HH:MM", 24h local (America/New_York)
  end?: string;       // "HH:MM"
  end_estimated?: boolean;
  title: string;
  zone: string | null;
  venue: string;
  category: string;
  selectable: boolean;
  highlight?: boolean;
  notes?: string;
}

export interface GmhgData {
  meta: GmhgMeta;
  events: GmhgEvent[];
}
