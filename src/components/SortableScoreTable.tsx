"use client";
import { useState } from "react";
import { sortRows, type SortDir } from "@/lib/tableSort";
import Sparkline from "@/components/Sparkline";

export interface ScoreRow { key: string; label: string; isFree: boolean; record: string; avg: number; days: number; spark: number[]; [k: string]: unknown; }
type ColKey = "label" | "avg" | "days";
const COLS: { key: ColKey; label: string; numeric: boolean }[] = [
  { key: "label", label: "Source", numeric: false },
  { key: "avg", label: "Avg", numeric: true },
  { key: "days", label: "Days", numeric: true },
];

export default function SortableScoreTable({ rows }: { rows: ScoreRow[] }) {
  const [sort, setSort] = useState<{ key: ColKey; dir: SortDir }>({ key: "avg", dir: "desc" });
  const sorted = sortRows(rows, sort.key, sort.dir);
  // Winner emphasis mirrors the hero scoreboard: the top free performer's
  // average reads emerald, independent of how the user has sorted the table.
  const topFree = Math.max(...rows.filter((r) => r.isFree).map((r) => r.avg));
  const toggle = (key: ColKey) =>
    setSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }));
  const aria = (key: ColKey) => (sort.key !== key ? "none" : sort.dir === "asc" ? "ascending" : "descending");

  return (
    <div>
      <table className="hidden w-full text-sm md:table">
        <thead>
          <tr className="border-b border-white/10 text-left">
            {COLS.map((c) => (
              <th key={c.key} aria-sort={aria(c.key)} className="py-2">
                <button type="button" onClick={() => toggle(c.key)} className="inline-flex items-center gap-1 font-medium hover:text-white">
                  {c.label}{sort.key === c.key ? (sort.dir === "desc" ? " ↓" : " ↑") : ""}
                </button>
              </th>
            ))}
            <th className="py-2 font-medium">Record</th>
            <th className="py-2 font-medium">Trend</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.key} className="border-b border-white/5">
              <td className={`py-2 ${r.isFree ? "text-emerald-300" : "text-slate-300"}`}>{r.label}</td>
              <td className={`py-2 tabular-nums ${r.isFree && r.avg === topFree ? "font-semibold text-emerald-300" : ""}`}>{r.avg.toFixed(1)}</td>
              <td className="py-2 tabular-nums">{r.days}</td>
              <td className="py-2 text-white/70">{r.record}</td>
              <td className="py-2"><Sparkline values={r.spark} stroke={r.isFree ? "var(--green)" : "#94a3b8"} label={`${r.label} score trend over ${r.spark.length} days`} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="space-y-3 md:hidden">
        {sorted.map((r) => (
          <li key={r.key} className="rounded-lg border border-white/10 p-3">
            <div className="flex items-center justify-between">
              <span className={`font-medium ${r.isFree ? "text-emerald-300" : "text-slate-300"}`}>{r.label}</span>
              <span className={`tabular-nums ${r.isFree && r.avg === topFree ? "font-semibold text-emerald-300" : ""}`}>{r.avg.toFixed(1)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-white/60">
              <span>{r.record} | {r.days} days</span>
              <Sparkline values={r.spark} stroke={r.isFree ? "var(--green)" : "#94a3b8"} label={`${r.label} score trend`} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
