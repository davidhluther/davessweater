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
  raw_points?: number;
  max_available?: number;
  grade: { verdict: string; ray_count: number };
  breakdown: Record<string, ScoreBreakdownField>;
}
export interface SourceEntry { prediction: Prediction; score: Score; }

export interface Comparison {
  date: string;
  generated_at?: string;
  actuals: Actuals;
  sweater_weather: SweaterWeather;
  sources: Partial<Record<"openmeteo" | "raysweather" | "apple_weather", SourceEntry>>;
}

export interface SourceTotals { right: number; wrong: number; meh: number; total_score: number; days: number; }
export interface Scores {
  entries: Array<Record<string, unknown>>;
  totals: Partial<Record<"openmeteo" | "raysweather" | "apple_weather", SourceTotals>>;
  coverage?: Partial<Record<"openmeteo" | "raysweather" | "apple_weather", Partial<Record<CoverageField, CoverageStat>>>>;
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

export interface BlogPost { title: string; link: string; date?: string; summary?: string; content?: string; }
export interface Video { title: string; link: string; date: string; thumb?: string; }
export interface Product { name: string; link: string; image?: string; price?: string; id?: string; }
