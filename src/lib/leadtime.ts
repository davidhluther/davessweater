import { readFile } from "node:fs/promises";
import { join } from "node:path";

const DATA = join(process.cwd(), "data");

// Shapes mirror scripts/leadtime.py's data/leadtime_scores.json artifact.
// Key names are a contract with the Python side — do not rename. Cells only
// exist where n > 0, and metrics can be null when every group value was null.
export type LeadCell = { n: number; avg_score?: number | null; high_mae?: number | null;
  low_mae?: number | null; high_bias?: number | null; low_bias?: number | null };
export type LeadtimeScores = { location: string; max_lead: number;
  by_source: Record<string, Record<string, LeadCell>> };

export async function getLeadtimeScores(): Promise<LeadtimeScores | null> {
  try { return JSON.parse(await readFile(join(DATA, "leadtime_scores.json"), "utf8")) as LeadtimeScores; }
  catch { return null; }
}

export type ChartSeries = { source: string; points: { lead: number; value: number }[] };

// One line per source for the decay chart: (lead, value) points for the chosen
// metric, null cells dropped, sorted by lead. minN floors out thin cells (the
// real data has a raysweather lead-5 cell with n=1 that must not chart).
export function toChartSeries(
  scores: LeadtimeScores, metric: Exclude<keyof LeadCell, "n">, opts?: { minN?: number },
): ChartSeries[] {
  const minN = opts?.minN ?? 0;
  return Object.entries(scores.by_source).map(([source, byLead]) => ({
    source,
    points: Object.entries(byLead)
      .filter(([, cell]) => cell.n >= minN)
      .map(([lead, cell]) => ({ lead: Number(lead), value: cell[metric] }))
      .filter((p): p is { lead: number; value: number } => typeof p.value === "number")
      .sort((a, b) => a.lead - b.lead),
  }));
}

// Mean high-MAE across the free composite members at a given lead — powers the
// consumer strip's honesty footer. EXCLUDE mirrors src/lib/composite.ts
// (raysweather is the graded forecaster; apple_weather mirrors the Open-Meteo
// fallback and would double-weight it).
const EXCLUDE = new Set(["raysweather", "apple_weather"]);

export function compositeMemberMae(scores: LeadtimeScores, lead: number): { mae: number; n: number } | null {
  const cells = Object.entries(scores.by_source)
    .filter(([k]) => !EXCLUDE.has(k))
    .map(([, byLead]) => byLead[String(lead)])
    .filter((c): c is LeadCell => !!c && typeof c.high_mae === "number" && c.n > 0);
  if (!cells.length) return null;
  const mae = cells.reduce((a, c) => a + (c.high_mae as number), 0) / cells.length;
  const n = Math.min(...cells.map((c) => c.n));
  return { mae: Math.round(mae * 10) / 10, n };
}
