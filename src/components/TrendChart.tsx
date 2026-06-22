import type { TrendPoint } from "@/lib/homeStats";
import { trendChartGeometry } from "@/lib/homeStats";

export default function TrendChart({ points }: { points: TrendPoint[] }) {
  const g = trendChartGeometry(points, 600, 120, 40, 100);
  return (
    <div>
      <svg viewBox={`0 0 ${g.width} ${g.height}`} className="w-full" role="img"
        aria-label="Daily forecast accuracy scores across the tracked season — the free forecasts versus Ray's Weather.">
        {g.rays && <polyline points={g.rays} fill="none" className="stroke-orange" strokeWidth="3" strokeDasharray="2 4" />}
        {g.free && <polyline points={g.free} fill="none" className="stroke-green" strokeWidth="3" />}
      </svg>
      <div className="mt-2 flex gap-4 text-xs text-white/70">
        <span><span className="mr-1.5 inline-block size-2.5 rounded-sm bg-green align-middle" />Free forecasts</span>
        <span><span className="mr-1.5 inline-block size-2.5 rounded-sm bg-orange align-middle" />Ray&apos;s Weather</span>
      </div>
    </div>
  );
}
