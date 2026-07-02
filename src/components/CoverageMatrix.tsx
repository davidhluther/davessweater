import type { Scores } from "@/lib/types";
import { coverageMatrix, type CoverageKind } from "@/lib/coverage";

const FILL: Record<CoverageKind, string> = {
  full: "bg-green",
  partial: "bg-orange",
  omission: "bg-orange-600",
};

export default function CoverageMatrix({ scores }: { scores: Scores | null }) {
  const rows = coverageMatrix(scores);
  if (!rows.length) return null;
  const fields = rows[0].cells;
  return (
    <div className="not-prose">
      <p className="mb-3 text-sm text-muted">
        Green cells are fully reported fields. Dark orange marks a deliberate gap, like{" "}
        <strong className="text-foreground">Ray&apos;s, who never publishes a precip amount</strong>. Lighter
        cells are days a value was not available to scrape.
      </p>

      {/* Matrix grid — hidden on mobile */}
      <div className="hidden overflow-hidden rounded-lg border border-border md:block">
        <div role="table" className="text-sm">
          <div role="row" className="grid grid-cols-[7rem_repeat(5,1fr)] border-b border-border bg-surface">
            <span role="columnheader" className="px-3 py-2 font-medium">Source</span>
            {fields.map((c) => (
              <span role="columnheader" key={c.field} className="px-2 py-2 text-center text-xs text-muted">{c.label}</span>
            ))}
          </div>
          {rows.map((r) => (
            <div role="row" key={r.key} className="grid grid-cols-[7rem_repeat(5,1fr)] items-center border-b border-border last:border-0">
              <span role="rowheader" className={`px-3 py-2 font-medium ${r.isFree ? "text-green-700" : "text-orange-600"}`}>{r.label}</span>
              {r.cells.map((c) => (
                <span role="cell" key={c.field} className="px-2 py-2 text-center"
                  title={`${c.provided}/${c.days} days`}>
                  <span className={`mx-auto block h-5 w-full max-w-[3rem] rounded ${FILL[c.kind]}`}
                    style={{ opacity: c.kind === "partial" ? 0.4 + 0.6 * c.ratio : 1 }} aria-hidden="true" />
                  <span className="mt-1 block text-[11px] text-muted">{c.kind === "omission" ? "none" : `${c.provided}/${c.days}`}</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Per-source blocks — hidden on md+ */}
      <ul className="space-y-3 md:hidden">
        {rows.map((r) => (
          <li key={r.key} className="rounded-lg border border-border p-3">
            <div className={`font-medium ${r.isFree ? "text-green-700" : "text-orange-600"}`}>{r.label}</div>
            <ul className="mt-2 space-y-1">
              {r.cells.map((c) => (
                <li key={c.field} className="flex items-center gap-2 text-sm" title={`${c.provided}/${c.days} days`}>
                  <span className={`block h-4 w-8 shrink-0 rounded ${FILL[c.kind]}`}
                    style={{ opacity: c.kind === "partial" ? 0.4 + 0.6 * c.ratio : 1 }} aria-hidden="true" />
                  <span className="flex-1">{c.label}</span>
                  <span className="tabular-nums text-muted">{c.kind === "omission" ? "none" : `${c.provided}/${c.days}`}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
