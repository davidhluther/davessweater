import type { LeafPrediction } from "@/lib/leaf";
import {
  elevationBand, fmtPeakWindow, hasThermalSignal, lapseRatePerThousandFt, ridgeOffsetPhrase,
} from "@/lib/leaf";
import { fmtLongDate } from "@/lib/dates";

// The seasonal module on a town's weather page: this town's predicted peak-color
// window, the arithmetic that produced it, and what the model does not know yet.
//
// Every number here is read from data/leaf/predictions.json, including the lapse
// rate, so the copy cannot drift away from the model that generated the dates.
// The two claims a reader can check by hand are deliberately on the page: the
// reference date at the reference elevation, and the days-per-1,000-ft slide.
//
// Deliberately NOT linked to a /leaf hub yet, because that page does not exist.
// When it ships, the one link belongs in the closing paragraph here.
export default function FallColorWindow({
  prediction, targetYear, modelVersion,
}: { prediction: LeafPrediction; targetYear: number; modelVersion: string }) {
  const window = fmtPeakWindow(prediction.peak_start, prediction.peak_end);
  if (!window) return null;

  const band = elevationBand(prediction.elevation_ft);
  const rate = lapseRatePerThousandFt(prediction);
  const refElev = prediction.components.reference_elevation_ft.toLocaleString();
  const anomaly = prediction.components.temp_anomaly_f;
  const shift = prediction.components.thermal_shift_days;
  const thermal = hasThermalSignal(prediction) && anomaly != null;

  return (
    <>
      <div className="ds-kicker text-orange-600">Fall color</div>
      <h2 className="mt-1 ds-h2">When {prediction.name} peaks</h2>

      <p className="mt-4 ds-stat text-orange-600">{window}</p>
      <p className="mt-1 ds-caption">Predicted peak window, fall {targetYear}</p>

      <p className="mt-4 ds-body">
        {prediction.name} sits at {prediction.elevation_ft.toLocaleString()} feet, {band.blurb}.
        Peak color reaches {refElev} feet around{" "}
        {fmtLongDate(prediction.components.reference_date)}
        {rate ? `, then slides about ${rate} days later for every 1,000 feet it descends` : ""}
        , which puts {prediction.name} {ridgeOffsetPhrase(prediction)}.
      </p>

      <p className="mt-3 ds-body text-muted">
        {thermal ? (
          <>
            September ran {Math.abs(anomaly).toFixed(1)}°F{" "}
            {anomaly > 0 ? "warmer" : "cooler"} than {prediction.name}&apos;s own normal, which moved
            the window {Math.abs(shift).toFixed(1)} days {shift > 0 ? "later" : "earlier"}. Warm
            autumns delay the shutdown that lets the color show. Cold ones hurry it along.
          </>
        ) : (
          <>
            That window is elevation and climatology alone right now. The September temperature term
            that nudges peak earlier or later stays switched off until this fall&apos;s numbers
            accrue, and these dates will move when it comes on. We would rather show you the
            gap than paper over it.
          </>
        )}
      </p>

      {/* LINK SLOT: when /leaf ships, one sentence at the end of the paragraph below
          pointing at the cross-town peak-color map. Nothing else on this page should
          link to it -- the town pages carry their own window only, so they and /leaf
          never compete for the same query. */}
      <p className="mt-3 ds-body text-muted">
        A peak window is a claim about October, so it gets graded like every other forecast here.
        Once the leaves actually turn we score these dates against the published fall color reports
        and the result goes on the board, flattering or not. This is the model&apos;s first live
        fall, so read the window as a first attempt with its work shown, not a settled number.
      </p>

      <p className="mt-3 ds-caption">
        {band.label} <span className="mx-1">|</span> Model {modelVersion}
      </p>
    </>
  );
}
