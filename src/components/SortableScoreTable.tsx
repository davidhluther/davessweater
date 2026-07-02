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

// Rank-based colors (owner call, 2026-07-02): the season winner reads emerald,
// the loser reads brand orange, everyone in between reads neutral slate —
// independent of how the user sorts the table.
type Tone = "win" | "mid" | "lose";
const TEXT: Record<Tone, string> = { win: "text-emerald-300", mid: "text-slate-300", lose: "text-orange-300" };
const STROKE: Record<Tone, string> = { win: "var(--green)", mid: "#94a3b8", lose: "var(--orange)" };

export default function SortableScoreTable({ rows }: { rows: ScoreRow[] }) {
  const [sort, setSort] = useState<{ key: ColKey; dir: SortDir }>({ key: "avg", dir: "desc" });
  const sorted = sortRows(rows, sort.key, sort.dir);
  const topAvg = Math.max(...rows.map((r) => r.avg));
  const lowAvg = Math.min(...rows.map((r) => r.avg));
  const tone = (r: ScoreRow): Tone =>
    r.avg === topAvg ? "win" : rows.length > 2 && r.avg === lowAvg ? "lose" : "mid";
  // Rank rail (owner pick, 2026-07-02): every row carries a thin standing-colored
  // left edge — emerald for the season winner, brand orange for the loser, slate
  // thinning out with rank in between. Standing sticks to the row through
  // re-sorts, same as the text tones.
  const merit = [...rows].sort((a, b) => b.avg - a.avg).map((r) => r.key);
  const rail = (r: ScoreRow): string => {
    const t = tone(r);
    if (t !== "mid") return STROKE[t];
    const f = Math.min(1, Math.max(0, (merit.indexOf(r.key) - 1) / Math.max(1, merit.length - 3)));
    return `rgba(148, 163, 184, ${(0.75 - 0.45 * f).toFixed(2)})`; // STROKE.mid, fading with rank
  };
  const toggle = (key: ColKey) =>
    setSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }));
  const aria = (key: ColKey) => (sort.key !== key ? "none" : sort.dir === "asc" ? "ascending" : "descending");

  return (
    <div>
      <table className="hidden w-full text-sm md:table">
        <thead>
          <tr className="border-b border-white/15 text-left">
            {COLS.map((c) => (
              <th key={c.key} aria-sort={aria(c.key)}
                className={c.key === "label" ? "border-l-[3px] border-l-transparent py-2 pl-2.5" : "py-2"}>
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
          {sorted.map((r) => {
            const t = tone(r);
            return (
              <tr key={r.key} className="border-b border-white/15">
                <td className={`border-l-[3px] py-2 pl-2.5 ${TEXT[t]}`} style={{ borderLeftColor: rail(r) }}>{r.label}</td>
                <td className={`py-2 tabular-nums ${TEXT[t]} ${t === "win" ? "font-semibold" : ""}`}>{r.avg.toFixed(1)}</td>
                <td className="py-2 tabular-nums">{r.days}</td>
                <td className="py-2 text-white/70">{r.record}</td>
                <td className="py-2"><Sparkline values={r.spark} stroke={STROKE[t]} label={`${r.label} score trend over ${r.spark.length} days`} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <ul className="space-y-3 md:hidden">
        {sorted.map((r) => {
          const t = tone(r);
          return (
            <li key={r.key} className="rounded-lg border border-l-[3px] border-white/10 p-3"
              style={{ borderLeftColor: rail(r) }}>
              <div className="flex items-center justify-between">
                <span className={`font-medium ${TEXT[t]}`}>{r.label}</span>
                <span className={`tabular-nums ${TEXT[t]} ${t === "win" ? "font-semibold" : ""}`}>{r.avg.toFixed(1)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-white/60">
                <span>{r.record} | {r.days} days</span>
                <Sparkline values={r.spark} stroke={STROKE[t]} label={`${r.label} score trend`} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
