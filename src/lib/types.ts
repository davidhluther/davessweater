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

export interface ScoreBreakdownField {
  predicted?: number; actual?: number; error_f?: number; error_mph?: number;
  predicted_in?: number; actual_in?: number; binary_correct?: boolean; error_in?: number;
  points: number; max: number;
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
  sources: Partial<Record<"openmeteo" | "raysweather" | "apple_weather", SourceEntry>>;
}

export interface SourceTotals { right: number; wrong: number; meh: number; total_score: number; days: number; }
export interface Scores {
  entries: Array<Record<string, unknown>>;
  totals: Partial<Record<"openmeteo" | "raysweather" | "apple_weather", SourceTotals>>;
}

export interface BlogPost { title: string; link: string; date: string; summary?: string; content?: string; }
export interface Video { title: string; link: string; date: string; thumb?: string; }
export interface Product { name: string; link: string; image?: string; price?: string; id?: string; }
