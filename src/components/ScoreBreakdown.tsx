import { Fragment } from "react";
import type { Score, ScoreBreakdownField } from "@/lib/types";

const FIELDS: Array<{ key: string; label: string; unit: string }> = [
  { key: "high_temp", label: "High temp", unit: "°" },
  { key: "low_temp", label: "Low temp", unit: "°" },
  { key: "wind", label: "Wind", unit: " mph" },
  { key: "precip_type", label: "Precip type", unit: "" },
  { key: "precip_amount", label: "Precip amount", unit: '"' },
];

function fmt(v: number | string | null | undefined, unit: string): string {
  if (v == null || v === "") return "—";
  if (typeof v === "number") return `${Math.round(v * 100) / 100}${unit}`;
  return String(v);
}

function offBy(f: ScoreBreakdownField, unit: string): string {
  if (f.error != null) return `±${Math.round(f.error * 100) / 100}${unit}`;
  if (f.predicted != null && f.actual != null) return f.predicted === f.actual ? "spot on" : "missed";
  return "—";
}

export default function ScoreBreakdown({ score }: { score: Score }) {
  const bd = score.breakdown ?? {};
  const rows = FIELDS.filter((field) => bd[field.key]);
  if (!rows.length) return null;
  return (
    <div className="mt-2 grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1 rounded-lg border border-border/70 bg-background px-3 py-2 text-[0.7rem] leading-tight">
      <div className="text-muted">Field</div>
      <div className="text-right text-muted">Predicted → actual</div>
      <div className="text-right text-muted">Pts</div>
      {rows.map(({ key, label, unit }) => {
        const f = bd[key];
        if (!f.scored) {
          return (
            <Fragment key={key}>
              <div className="text-muted">{label} <span>· not published</span></div>
              <div className="text-right text-muted">— → {fmt(f.actual, unit)}</div>
              <div className="text-right text-muted">—</div>
            </Fragment>
          );
        }
        return (
          <Fragment key={key}>
            <div className="text-muted">
              {label} <span>· {offBy(f, unit)}</span>
            </div>
            <div className="text-right text-foreground">
              {fmt(f.predicted, unit)} <span className="text-muted">→</span> {fmt(f.actual, unit)}
            </div>
            <div className="text-right font-semibold text-foreground">
              {f.points}<span className="text-muted">/{f.max}</span>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
