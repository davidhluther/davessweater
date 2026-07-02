import type { Composite } from "@/lib/composite";

export type WxVariant = "wx-rain" | "wx-snow" | "wx-mixed" | "wx-hot" | "wx-crisp" | "wx-mild";

// Maps the day's composite forecast to a hero-backdrop variant (see
// WeatherBackdrop.tsx + the `.wx` system in globals.css). The temperature
// thresholds deliberately reuse the published sweater-weather boundaries
// (75°F = "no sweater", 55°F = the maybe→yes sweater edge in lib/sweater.ts),
// so the mapping is defensible from the site's own methodology.
export function wxVariant(c: Pick<Composite, "precip" | "high"> | null): WxVariant {
  if (!c) return "wx-mild";
  if (c.precip === "rain") return "wx-rain";
  if (c.precip === "snow") return "wx-snow";
  if (c.precip === "mixed") return "wx-mixed";
  return c.high >= 75 ? "wx-hot" : c.high < 55 ? "wx-crisp" : "wx-mild";
}
