import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export type ScreenshotSource = "apple" | "openmeteo";

// Heuristic: the manually-uploaded real Apple Weather screenshots are ~2MB+ photos;
// the auto Open-Meteo fallback renders ~90KB. A robust signal (a source sidecar marker)
// belongs to the separate Shortcut-automation task — until then, size is the distinguisher.
export const REAL_APPLE_MIN_BYTES = 500_000;

export function classifyScreenshotSource(bytes: number): ScreenshotSource {
  return bytes >= REAL_APPLE_MIN_BYTES ? "apple" : "openmeteo";
}

export interface ScreenshotInfo { available: boolean; date: string | null; source: ScreenshotSource; }

// Mirrors scripts/prepare_public.mjs: newest YYYY-MM-DD dir that has iphone_screenshot.png.
export function latestScreenshotInfo(): ScreenshotInfo {
  const pred = join(process.cwd(), "data", "predictions");
  const fallback: ScreenshotInfo = { available: false, date: null, source: "openmeteo" };
  if (!existsSync(pred)) return fallback;
  const dirs = readdirSync(pred)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && statSync(join(pred, d)).isDirectory())
    .sort();
  for (let i = dirs.length - 1; i >= 0; i--) {
    const png = join(pred, dirs[i], "iphone_screenshot.png");
    if (existsSync(png)) {
      return { available: true, date: dirs[i], source: classifyScreenshotSource(statSync(png).size) };
    }
  }
  return fallback;
}
