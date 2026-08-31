import { leafBarPosition, type LeafBandRow, type LeafSeasonSpan } from "@/lib/leaf";
import { fmtPeakWindow } from "@/lib/leaf";

// The gradient in one picture: four elevation bands, each a bar sitting where
// its towns peak on a track spanning the whole season. This is the thing no
// single town page can show, and the reason the hub exists.
//
// Every bar is positioned from the data (leafBarPosition), never hand-placed,
// so a rerun of the model moves the picture without anyone touching this file.
// The dates are printed next to every bar because a bar alone is a shape, not a
// forecast, and a reader on a phone should not have to measure pixels.
export default function LeafSeasonStrip({
  span, bands,
}: { span: LeafSeasonSpan; bands: LeafBandRow[] }) {
  return (
    <div className="mt-6 space-y-5">
      {bands.map((band) => {
        const pos = leafBarPosition(span, band.start, band.end);
        const window = fmtPeakWindow(band.start, band.end);
        return (
          <div key={band.label}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="ds-h4">{band.label}</span>
              <span className="ds-caption tabular-nums">
                {window} <span className="mx-1">|</span> {band.towns.length}{" "}
                {band.towns.length === 1 ? "town" : "towns"}
              </span>
            </div>
            <div
              className="mt-2 h-3 w-full overflow-hidden rounded-full bg-border"
              role="presentation"
            >
              {pos ? (
                <div
                  className="h-full rounded-full bg-orange"
                  style={{ marginLeft: `${pos.leftPct}%`, width: `${pos.widthPct}%` }}
                />
              ) : null}
            </div>
          </div>
        );
      })}
      <p className="ds-caption">
        Every track above runs {fmtPeakWindow(span.start, span.end)}, the full predicted season
        across all {span.days} days of it. The bar is where that band sits inside it.
      </p>
    </div>
  );
}
