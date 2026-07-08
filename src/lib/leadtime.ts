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

// Series for the /right-wrong-ray accuracy-decay chart. minN 10: the real
// data has a raysweather lead-5 cell with n=1 that must not chart. Sources
// left with fewer than 2 surviving points are dropped entirely — a decay line
// needs 2 points, and anything less would still render a lone dot and a ghost
// legend entry claiming a story the source doesn't have (this also subsumes
// the empty-series case). Returns null (render nothing) unless at least 2
// such lines remain: a decay COMPARISON needs 2 lines.
export function decayChartSeries(scores: LeadtimeScores | null): ChartSeries[] | null {
  if (!scores) return null;
  const series = toChartSeries(scores, "avg_score", { minN: 10 }).filter((s) => s.points.length >= 2);
  return series.length >= 2 ? series : null;
}

// Leads the /methodology bias disclosure reads. Lead 5 is deliberately
// outside the window: Ray's lead-5 sample is a single day (the same reason
// decayChartSeries floors it).
const BIAS_LEADS = [0, 1, 2, 3, 4];

// Min…max of a source's high-temp bias across leads 0-4, for the live
// "+X.X to +Y.Y°F warm at every horizon" sentence on /methodology. The
// sentence claims warm-at-every-horizon, so this returns null — omit the
// sentence — unless every populated lead is warm-positive, and unless 2+
// leads have data ("every horizon" needs more than one).
export function warmBiasRange(
  scores: LeadtimeScores | null, source: string,
): { min: number; max: number } | null {
  const byLead = scores?.by_source?.[source];
  if (!byLead) return null;
  const vals = BIAS_LEADS.map((l) => byLead[String(l)]?.high_bias)
    .filter((v): v is number => typeof v === "number");
  if (vals.length < 2 || vals.some((v) => v <= 0)) return null;
  return { min: Math.min(...vals), max: Math.max(...vals) };
}

// Mean high-MAE across the free composite members at a given lead — powers the
// consumer strip's honesty footer. EXCLUDE mirrors src/lib/composite.ts
// (raysweather is the graded forecaster; apple_weather mirrors the Open-Meteo
// fallback and would double-weight it).
const EXCLUDE = new Set(["raysweather", "apple_weather"]);

const usable = (c: LeadCell | undefined): c is LeadCell =>
  !!c && typeof c.high_mae === "number" && c.n > 0;

export function compositeMemberMae(scores: LeadtimeScores, lead: number): { mae: number; n: number } | null {
  const cells = Object.entries(scores.by_source)
    .filter(([k]) => !EXCLUDE.has(k))
    .map(([, byLead]) => byLead[String(lead)])
    .filter(usable);
  if (!cells.length) return null;
  const mae = cells.reduce((a, c) => a + (c.high_mae as number), 0) / cells.length;
  const n = Math.min(...cells.map((c) => c.n));
  return { mae: Math.round(mae * 10) / 10, n };
}

// Same statistic at two leads over the INTERSECTED member set: only sources
// with a usable cell at BOTH leads count, so the "day 1 vs day 5" footer
// compares like with like. Computing each side independently (two
// compositeMemberMae calls) would let the set drift — e.g. weatherapi and
// googleweather stop at lead 2, so they'd inflate the lead-1 side while
// sitting out of lead 5. One call guarantees set consistency.
export function compositeMemberMaePair(
  scores: LeadtimeScores, leadA: number, leadB: number,
): { a: { mae: number; n: number }; b: { mae: number; n: number }; members: number } | null {
  const pairs = Object.entries(scores.by_source)
    .filter(([k]) => !EXCLUDE.has(k))
    .map(([, byLead]) => ({ a: byLead[String(leadA)], b: byLead[String(leadB)] }))
    .filter((p): p is { a: LeadCell; b: LeadCell } => usable(p.a) && usable(p.b));
  if (!pairs.length) return null;
  const side = (cells: LeadCell[]) => ({
    mae: Math.round((cells.reduce((s, c) => s + (c.high_mae as number), 0) / cells.length) * 10) / 10,
    n: Math.min(...cells.map((c) => c.n)),
  });
  return { a: side(pairs.map((p) => p.a)), b: side(pairs.map((p) => p.b)), members: pairs.length };
}
