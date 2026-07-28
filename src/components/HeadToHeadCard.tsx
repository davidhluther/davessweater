import type { HeadToHead } from "@/lib/homeStats";

export default function HeadToHeadCard({ h }: { h: HeadToHead }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-border bg-background p-4">
        <div className="ds-caption">Dave&apos;s Sweater Index</div>
        <div className="ds-stat text-green">
          {h.dave != null ? h.dave.toFixed(1) : "—"}<span className="ds-body text-muted">/100</span>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-background p-4">
        <div className="ds-caption">Ray&apos;s Weather</div>
        <div className="ds-stat text-slate-500">
          {h.rays != null ? h.rays.toFixed(1) : "—"}<span className="ds-body text-muted">/100</span>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-background p-4">
        <div className="ds-caption">What actually happened</div>
        <div className="mt-0.5 ds-caption leading-relaxed text-foreground">
          {h.actualLines.length ? h.actualLines.map((l, i) => <div key={i}>{l}</div>) : "—"}
        </div>
      </div>
    </div>
  );
}
