import { fmtLongDate } from "@/lib/dates";
import { isoWeekday, type BusynessDay } from "@/lib/tourism";

// The next fourteen days, one row each: the score, the band it lands in, and
// the reasons the engine gave for it. The drivers are the engine's own strings,
// printed as written rather than paraphrased, because the point of the row is
// that you can see what moved the number.

const BAND_STYLE: Record<string, string> = {
  calm: "bg-border text-muted",
  typical: "bg-teal-50 text-teal-900",
  busy: "bg-teal/70 text-white",
  slammed: "bg-orange text-white",
};

const BAND_LABEL: Record<string, string> = {
  calm: "Calm",
  typical: "Typical",
  busy: "Busy",
  slammed: "Slammed",
};

function weekdayShort(date: string): string {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][isoWeekday(date)];
}

export default function BusynessHorizon({ days }: { days: BusynessDay[] }) {
  if (!days.length) return null;
  return (
    <ul className="mt-6 divide-y divide-border border-y border-border">
      {days.map((d) => (
        <li key={d.date} className="py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="ds-h4">
              {weekdayShort(d.date)} <span className="mx-1">|</span> {fmtLongDate(d.date)}
            </span>
            <span className="flex items-baseline gap-2">
              <span className="ds-caption tabular-nums">{Math.round(d.score)}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${BAND_STYLE[d.band] ?? BAND_STYLE.calm}`}
              >
                {BAND_LABEL[d.band] ?? d.band}
              </span>
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-border" role="presentation">
            <div
              className={`h-full rounded-full ${d.band === "slammed" ? "bg-orange" : "bg-teal"}`}
              style={{ width: `${Math.max(2, Math.min(100, d.score))}%` }}
            />
          </div>
          {d.drivers.length ? (
            <p className="mt-2 ds-caption">{d.drivers.join(" | ")}</p>
          ) : (
            <p className="mt-2 ds-caption">Nothing on the calendar and nothing in the pricing.</p>
          )}
        </li>
      ))}
    </ul>
  );
}
