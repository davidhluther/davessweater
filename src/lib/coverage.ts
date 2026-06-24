import type { Scores, CoverageField, CoverageStat } from "@/lib/types";

const SOURCES: { key: "openmeteo" | "raysweather"; label: string; isFree: boolean }[] = [
  { key: "openmeteo", label: "Open-Meteo", isFree: true },
  { key: "raysweather", label: "Ray's Weather", isFree: false },
];
const FIELDS: { field: CoverageField; label: string }[] = [
  { field: "high_temp", label: "High temp" },
  { field: "low_temp", label: "Low temp" },
  { field: "wind", label: "Wind" },
  { field: "precip_type", label: "Precip type" },
  { field: "precip_amount", label: "Precip amount" },
];

export type CoverageKind = "full" | "partial" | "omission";
export interface CoverageCell { field: CoverageField; label: string; provided: number; days: number; ratio: number; kind: CoverageKind; }
export interface CoverageRow { key: string; label: string; isFree: boolean; cells: CoverageCell[]; }

function kindOf(provided: number, days: number): CoverageKind {
  if (provided <= 0) return "omission";
  if (provided >= days) return "full";
  return "partial";
}

export function coverageMatrix(scores: Scores | null): CoverageRow[] {
  const cov = scores?.coverage ?? {};
  return SOURCES.filter((s) => cov[s.key]).map((s) => ({
    key: s.key, label: s.label, isFree: s.isFree,
    cells: FIELDS.map(({ field, label }) => {
      const stat: CoverageStat = cov[s.key]![field] ?? { provided: 0, days: 0 };
      const days = stat.days || 0;
      return { field, label, provided: stat.provided, days, ratio: days ? stat.provided / days : 0, kind: kindOf(stat.provided, days) };
    }),
  }));
}
