import Link from "next/link";
import { fmtPeakWindow, ridgeOffsetPhrase, type LeafPrediction } from "@/lib/leaf";

// Every tracked town's predicted window, earliest peak first, so the elevation
// gradient reads straight down the page: Beech Mountain at the top in early
// October, the Wilkes County valley towns at the bottom in November.
//
// Town names link to that town's own weather page, where the same window is
// shown with its arithmetic. Boone has no /weather/boone twin (it keeps the
// site root), so its link goes to `/`.
function townHref(slug: string): string {
  return slug === "boone" ? "/" : `/weather/${slug}`;
}

// ridgeOffsetPhrase writes a mid-sentence clause ("about 12 days behind ..."),
// which is what the town pages need. A table cell starts a line of its own, so
// it gets a capital -- the house rule the copy lint enforces as CELL_CASE.
function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function LeafTownTable({ predictions }: { predictions: LeafPrediction[] }) {
  return (
    <div className="mt-4 overflow-x-auto">
      {/* The ridge-offset column is a readable restatement of elevation, not new
          data, so it is dropped below `sm` rather than pushing the three columns
          that matter off a phone screen. Same reason the min-width only applies
          from `sm` up, and the deliberate `text-xs` below it: at 390px the three
          columns land at 330px against a 358px container, so a reader on a phone
          gets the whole forecast without scrolling sideways for the dates, which
          are the reason the table exists. The container still scrolls if a
          longer town name ever changes that. */}
      <table className="w-full text-xs sm:min-w-[32rem] sm:text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted">
            <th className="py-2 pr-3">Town</th>
            <th className="py-2 pr-3">Elevation</th>
            <th className="py-2 pr-3">Predicted peak</th>
            <th className="hidden py-2 sm:table-cell">Against the ridges</th>
          </tr>
        </thead>
        <tbody className="align-top">
          {predictions.map((p) => (
            <tr key={p.slug} className="border-b border-border/60">
              <td className="py-2 pr-3 font-medium whitespace-nowrap">
                <Link href={townHref(p.slug)} className="underline underline-offset-2">
                  {p.name}
                </Link>
              </td>
              <td className="py-2 pr-3 tabular-nums whitespace-nowrap">
                {p.elevation_ft.toLocaleString()} ft
              </td>
              <td className="py-2 pr-3 font-medium whitespace-nowrap text-orange-600">
                {fmtPeakWindow(p.peak_start, p.peak_end)}
              </td>
              <td className="hidden py-2 text-muted sm:table-cell">
                {sentenceCase(ridgeOffsetPhrase(p))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
