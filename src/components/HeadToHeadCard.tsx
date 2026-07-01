import type { HeadToHead } from "@/lib/homeStats";

export default function HeadToHeadCard({ h }: { h: HeadToHead }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-border bg-background p-4">
        <div className="text-xs text-muted">Dave&apos;s Sweater</div>
        <div className="font-display text-3xl font-bold text-green">
          {h.dave != null ? h.dave.toFixed(1) : "—"}<span className="text-sm text-muted">/100</span>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-background p-4">
        <div className="text-xs text-muted">Ray&apos;s Weather</div>
        <div className="font-display text-3xl font-bold text-orange-600">
          {h.rays != null ? h.rays.toFixed(1) : "—"}<span className="text-sm text-muted">/100</span>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-background p-4">
        <div className="text-xs text-muted">What actually happened</div>
        <div className="mt-0.5 text-[0.8rem] leading-relaxed text-foreground">
          {h.actualLines.length ? h.actualLines.map((l, i) => <div key={i}>{l}</div>) : "—"}
        </div>
      </div>
    </div>
  );
}
