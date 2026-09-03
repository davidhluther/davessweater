// GET /api/v1/tourism — the Busy-ness Index as JSON.
//
// Shipped as a handler behind the existing /api/v1/[endpoint] catch-all rather
// than as its own route file: a route file is what costs a Vercel Serverless
// Function, and this repo deploys on Hobby's 12-function cap with a budget of
// 10 already spoken for. Adding a sibling route here would have been the same
// mistake that froze production for two days in August 2026.
//
// Params:
//   detail=summary (default) — the scored horizon plus this weekend's call
//   detail=full              — adds every component behind each day, the named
//                              events, and the lodging high-share calendar
//
// The engine's own `provisional` flag and note are passed through verbatim.
// A consumer that reprints our numbers should reprint that caveat with them.

import { jsonError, jsonOk } from "@/lib/apiResponse";
import { parseDetail } from "@/lib/publicFeed";
import {
  crossConfirmation,
  eventOverlay,
  getAthleticsNames,
  getBusynessArchiveSpan,
  getBusynessIndex,
  getBusynessObservations,
  getLodgingCapture,
  getRegistryEvents,
  upcomingWeekend,
  vsTypical,
} from "@/lib/tourism";

export async function tourism(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const detail = parseDetail(params.get("detail"));
  if (!detail.ok) return jsonError(400, detail.error);
  const full = detail.value === "full";

  const indexFile = await getBusynessIndex();
  if (!indexFile) {
    return jsonError(503, "The Busy-ness Index has not been computed yet");
  }
  const { issued, index } = indexFile;
  const horizon = index.horizon;

  const [observations, archive] = await Promise.all([
    getBusynessObservations(),
    getBusynessArchiveSpan(),
  ]);

  const weekend = upcomingWeekend(horizon, issued);
  const peak = weekend?.peak ?? horizon[0];
  const ranking = vsTypical(observations, { issued, date: peak.date, score: peak.score });

  const days = horizon.map((d) => ({
    date: d.date,
    score: d.score,
    band: d.band,
    drivers: d.drivers,
    ...(full ? { components: d.components, events: d.events } : {}),
  }));

  const body: Record<string, unknown> = {
    region: "North Carolina High Country",
    issued,
    computed_at: index.computed_at,
    provisional: index.provisional,
    ...(index.provisional_note ? { provisional_note: index.provisional_note } : {}),
    scale: { min: 0, max: 100, bands: { calm: "<35", typical: "35-54", busy: "55-74", slammed: ">=75" } },
    weekend: {
      friday: weekend?.friday ? { date: weekend.friday.date, score: weekend.friday.score, band: weekend.friday.band } : null,
      saturday: weekend?.saturday ? { date: weekend.saturday.date, score: weekend.saturday.score, band: weekend.saturday.band } : null,
      call: { date: peak.date, score: peak.score, band: peak.band, drivers: peak.drivers },
      // null when the archive is too short to rank this night honestly. A
      // consumer must handle that rather than assume a number is always here.
      vs_typical: ranking,
    },
    horizon: days,
    ...(archive ? { archive: { mornings: archive.days, from: archive.from, to: archive.to } } : {}),
    missing_inputs: index.missing_inputs,
  };

  if (full) {
    const [registry, athletics, lodging] = await Promise.all([
      getRegistryEvents(),
      getAthleticsNames(),
      getLodgingCapture(),
    ]);
    body.events = eventOverlay(horizon, registry, athletics);
    body.cross_confirmed = crossConfirmation(horizon);
    body.lodging = lodging
      ? {
          captured: lodging.captured,
          source: lodging.capture.source,
          notes: lodging.capture.notes ?? [],
          high_share: lodging.capture.summary.high_share,
        }
      : null;
  }

  return jsonOk(body);
}
