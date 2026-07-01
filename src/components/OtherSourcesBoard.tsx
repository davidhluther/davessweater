import type { OtherSourceRow } from "@/lib/scoreboard";
import { MIN_SCORED_DAYS } from "@/lib/gating";

// "The rest of the field" — the other free forecasters we track beyond the
// Ray-vs-Open-Meteo headline. Sources with a full track record (>= MIN_SCORED_DAYS)
// are ranked by accuracy; newer ones are shown as provisional with their day
// count, so a thin sample is never presented as an established record.
export default function OtherSourcesBoard({ rows }: { rows: OtherSourceRow[] }) {
  if (!rows.length) return null;
  const ranked = rows.filter((r) => !r.provisional).sort((a, b) => b.avg - a.avg);
  const provisional = rows
    .filter((r) => r.provisional)
    .sort((a, b) => b.days - a.days || b.avg - a.avg);

  return (
    <div className="not-prose">
      {ranked.length > 0 && (
        <>
          <table className="hidden w-full text-sm sm:table">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-2">Source</th><th>Avg</th><th>Record</th><th>Days</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((r) => (
                <tr key={r.key} className="border-t border-border">
                  <td className="py-2 font-medium text-green">{r.label}</td>
                  <td className="tabular-nums font-semibold">{r.avg.toFixed(1)}</td>
                  <td className="text-muted">{r.record}</td>
                  <td className="tabular-nums text-muted">{r.days}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="space-y-2 sm:hidden">
            {ranked.map((r) => (
              <li key={r.key} className="rounded-xl border border-border bg-background p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-green">{r.label}</span>
                  <span className="tabular-nums font-semibold">{r.avg.toFixed(1)}</span>
                </div>
                <div className="mt-1 text-xs text-muted">{r.record} &middot; {r.days} days</div>
              </li>
            ))}
          </ul>
        </>
      )}

      {provisional.length > 0 && (
        <div className={ranked.length ? "mt-6" : ""}>
          <p className="mb-3 text-sm text-muted">
            {`${ranked.length ? "Still gathering data" : "These forecasters are new to the board"}. Each needs ${MIN_SCORED_DAYS} scored days before it's ranked. Here is the running average so far:`}
          </p>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {provisional.map((r) => (
              <li key={r.key}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <span className="font-medium text-green">{r.label}</span>
                <span className="text-muted">
                  <span className="tabular-nums text-foreground">{r.avg.toFixed(1)}</span>
                  {" · "}{r.days} of {MIN_SCORED_DAYS} days
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
