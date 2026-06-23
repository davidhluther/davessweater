import type { Comparison, ScoreBreakdownField } from "@/lib/types";
import { actualLines } from "@/lib/homeStats";

const FIELD_LABELS: Record<string, string> = {
  high_temp: "High", low_temp: "Low", wind: "Wind", precip_type: "Precip", precip_amount: "Precip amount",
};

export interface RayMiss {
  field: string; label: string;
  predicted: number | string | null; actual: number | string | null;
  error: number | null; unit?: string; published: boolean;
}
export interface TooltipEntry {
  date: string; openmeteo: number | null; rays: number | null;
  actualLines: string[]; rayMisses: RayMiss[];
}

const num = (v: unknown): number | null => (typeof v === "number" && isFinite(v) ? v : null);

export function buildTooltipMap(comparisons: Comparison[]): Record<string, TooltipEntry> {
  const map: Record<string, TooltipEntry> = {};
  for (const c of comparisons) {
    if (!c?.date) continue;
    const rayBd = (c.sources?.raysweather?.score?.breakdown ?? {}) as Record<string, ScoreBreakdownField>;
    const rayMisses: RayMiss[] = Object.entries(rayBd).map(([field, f]) => ({
      field, label: FIELD_LABELS[field] ?? field,
      predicted: f.predicted ?? null, actual: f.actual ?? null,
      error: num(f.error), unit: f.unit, published: f.scored !== false,
    }));
    map[c.date] = {
      date: c.date,
      openmeteo: num(c.sources?.openmeteo?.score?.score),
      rays: num(c.sources?.raysweather?.score?.score),
      actualLines: actualLines(c.actuals),
      rayMisses,
    };
  }
  return map;
}
