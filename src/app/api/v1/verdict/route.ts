// GET /api/v1/verdict?town=&date=YYYY-MM-DD
// The daily Right/Wrong Ray result: per-source day scores + grades for a scored
// day (defaults to the latest scored day — "yesterday" once actuals land).
export const dynamic = "force-dynamic";

import { jsonOk, jsonError, corsPreflight } from "@/lib/apiResponse";
import { getTown, isTownPublic, publicSlugs, getTownComparison, latestComparisonDate } from "@/lib/towns";
import { fmtLongDate } from "@/lib/dates";

export function OPTIONS() {
  return corsPreflight();
}

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const slug = sp.get("town") || "boone";

  if (!(await isTownPublic(slug))) {
    return jsonError(404, `Unknown or not-yet-tracked town: "${slug}"`, {
      valid_towns: await publicSlugs(),
    });
  }

  const requested = sp.get("date");
  if (requested && !/^\d{4}-\d{2}-\d{2}$/.test(requested)) {
    return jsonError(400, `date must be YYYY-MM-DD; got "${requested}"`);
  }
  const date = requested || (await latestComparisonDate(slug));
  if (!date) {
    return jsonError(404, `No scored days available for "${slug}"`);
  }
  const comp = await getTownComparison(slug, date);
  if (!comp) {
    return jsonError(404, `No scored result for "${slug}" on ${date}`);
  }
  const town = await getTown(slug);

  const sources: Record<string, { score: number; verdict: string; ray_count: number }> = {};
  for (const [key, entry] of Object.entries(comp.sources)) {
    if (!entry?.score) continue;
    sources[key] = {
      score: Math.round(entry.score.score * 10) / 10,
      verdict: entry.score.grade.verdict,
      ray_count: entry.score.grade.ray_count,
    };
  }

  // "Right Ray / Wrong Ray": did the paid incumbent keep pace with our free
  // consensus? Dave's number is the Dave's Sweater Index (composite), falling
  // back to Open-Meteo on days that predate the DSI. Null Ray = no station here.
  const dave = sources.composite?.score ?? sources.openmeteo?.score ?? null;
  const rays = sources.raysweather?.score ?? null;
  const headline =
    rays == null
      ? { verdict: null, dave_score: dave, rays_score: null, note: "Ray's Weather has no station in this town" }
      : { verdict: dave != null && dave > rays ? "Wrong Ray" : "Right Ray", dave_score: dave, rays_score: rays };

  const a = comp.actuals;
  return jsonOk({
    town: { slug, name: town?.name ?? slug },
    date,
    date_label: fmtLongDate(date),
    headline,
    actuals: {
      high_f: a.high_f ?? null,
      low_f: a.low_f ?? null,
      wind_mph: a.wind_mph ?? null,
      precip_in: a.precip_in ?? null,
      conditions: a.conditions ?? null,
    },
    sources,
  });
}
