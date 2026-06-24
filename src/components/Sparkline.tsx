import { sparkPath } from "@/lib/sparkline";

export default function Sparkline({ values, stroke, width = 96, height = 24, label }:
  { values: number[]; stroke: string; width?: number; height?: number; label: string }) {
  const d = sparkPath(values, width, height - 2);
  if (!d) return <span className="text-xs text-white/40">—</span>;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="overflow-visible">
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.5} transform="translate(0,1)" />
    </svg>
  );
}
