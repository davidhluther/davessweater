import { heatBucket, isoWeekday, type HeatDay } from "@/lib/tourism";

// Thirty days of hotel pricing, one square a day.
//
// The shade is the share of rostered hotels that have priced that night into
// their own "high" band, which is the closest thing to a room-demand reading
// that exists for free. A night nobody has priced yet is drawn hollow rather
// than dark, because "no reading" and "nobody wants it" are different facts and
// a calendar that renders them the same way is lying with colour.

const FILL: Record<number, string> = {
  0: "bg-border text-muted",
  1: "bg-teal-50 text-teal-900",
  2: "bg-teal/40 text-teal-900",
  3: "bg-teal/75 text-white",
  4: "bg-teal-800 text-white",
};

const LEGEND: { bucket: 0 | 1 | 2 | 3 | 4; label: string }[] = [
  { bucket: 0, label: "None" },
  { bucket: 1, label: "A few" },
  { bucket: 2, label: "Some" },
  { bucket: 3, label: "Most" },
  { bucket: 4, label: "Nearly all" },
];

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function pct(share: number): string {
  return `${Math.round(share * 100)}%`;
}

export default function BusynessCalendar({ days }: { days: HeatDay[] }) {
  if (!days.length) return null;
  // Pad the first week so every square sits under its real weekday column.
  const lead = isoWeekday(days[0].date);
  const cells: (HeatDay | null)[] = [...Array.from({ length: lead }, () => null), ...days];

  return (
    <div className="mt-6">
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {WEEKDAYS.map((d, i) => (
          <div key={i} className="pb-1 text-center ds-caption">
            {d}
          </div>
        ))}
        {cells.map((cell, i) => {
          if (!cell) return <div key={`pad-${i}`} aria-hidden="true" />;
          const bucket = heatBucket(cell.share);
          const dayNum = Number(cell.date.slice(8));
          const fill =
            bucket === null ? "border border-dashed border-border text-muted" : FILL[bucket];
          const label =
            cell.share === null
              ? `${cell.date}: not priced yet`
              : `${cell.date}: ${pct(cell.share)} of hotels priced high`;
          return (
            <div
              key={cell.date}
              title={label}
              className={`flex aspect-square flex-col items-center justify-center rounded-md text-center tabular-nums ${fill}`}
            >
              <span className="text-xs font-semibold leading-none sm:text-sm">{dayNum}</span>
              <span className="mt-0.5 text-[9px] leading-none opacity-80 sm:text-[10px]">
                {cell.share === null ? "" : pct(cell.share)}
              </span>
              <span className="sr-only">{label}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="ds-caption">Hotels pricing the night high</span>
        {LEGEND.map((l) => (
          <span key={l.bucket} className="flex items-center gap-1.5">
            <span className={`inline-block size-3 rounded-sm ${FILL[l.bucket]}`} aria-hidden="true" />
            <span className="ds-caption">{l.label}</span>
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block size-3 rounded-sm border border-dashed border-border"
            aria-hidden="true"
          />
          <span className="ds-caption">Not priced yet</span>
        </span>
      </div>
    </div>
  );
}
