import { fmtLongDate } from "@/lib/dates";
import type { RatePoint } from "@/lib/tourism";

// What a Saturday night costs in Boone, one bar per weekend.
//
// Every bar is the median cheapest listed rate across the hotels we track, read
// at the SAME lead time for every weekend, so the differences between bars are
// about the weekend rather than about how far out we happened to look. Bars are
// scaled against the highest one in the series, and the number is printed beside
// each bar because a bar alone is a shape.

export default function WeekendRateTrend({
  points,
  typical,
}: {
  points: RatePoint[];
  typical: number | null;
}) {
  if (points.length < 2) return null;
  const top = Math.max(...points.map((p) => p.median));

  return (
    <div className="mt-6 space-y-3">
      {points.map((p) => {
        const width = Math.max(4, (p.median / top) * 100);
        const dear = typical !== null && p.median > typical * 1.2;
        return (
          <div key={p.stay}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="ds-body">{fmtLongDate(p.stay)}</span>
              <span className={`ds-caption tabular-nums ${dear ? "text-orange-600" : ""}`}>
                ${Math.round(p.median)} <span className="mx-1">|</span> {p.hotels}{" "}
                {p.hotels === 1 ? "hotel" : "hotels"}
              </span>
            </div>
            <div className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-border" role="presentation">
              <div
                className={`h-full rounded-full ${dear ? "bg-orange" : "bg-teal"}`}
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
      {typical !== null ? (
        <p className="ds-caption">
          The median Saturday across every weekend above is ${Math.round(typical)}. Bars more than a
          fifth above it are marked.
        </p>
      ) : null}
    </div>
  );
}
