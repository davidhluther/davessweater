// GET /api/v1/towns
// The town registry that drives the `town` param everywhere else: slug, name,
// coordinates, elevation, Ray's-station presence, and scored-day count. Only
// towns past the MIN_SCORED_DAYS gate appear (Boone always) — the same honesty
// rule the site applies to a source's track record.

import { jsonOk } from "@/lib/apiResponse";
import { listPublicTowns } from "@/lib/towns";
import { MIN_SCORED_DAYS } from "@/lib/gating";

export async function towns(): Promise<Response> {
  const registry = await listPublicTowns();
  return jsonOk({
    gate: { min_scored_days: MIN_SCORED_DAYS },
    count: registry.length,
    towns: registry.map((t) => ({
      slug: t.slug,
      name: t.name,
      lat: t.lat,
      lon: t.lon,
      elevation_ft: t.elevation_ft,
      county: t.county ?? null,
      has_rays: t.has_rays,
      scored_days: t.scored_days,
    })),
  });
}
