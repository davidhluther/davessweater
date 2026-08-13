// Served by the src/app/api/v1/[...path] catch-all, not its own route file:
// each route directory would cost a Serverless Function against the Vercel
// Hobby cap of 12. Public URL is unchanged. See src/lib/ogStatic.ts + CHECKLIST.md.
// Handler for GET /api/v1/towns
// The town registry that drives the `town` param everywhere else: slug, name,
// coordinates, elevation, Ray's-station presence, and scored-day count. Only
// towns past the MIN_SCORED_DAYS gate appear (Boone always) — the same honesty
// rule the site applies to a source's track record.

import { jsonOk } from "@/lib/apiResponse";
import { listPublicTowns } from "@/lib/towns";
import { MIN_SCORED_DAYS } from "@/lib/gating";

export async function towns() {
  const towns = await listPublicTowns();
  return jsonOk({
    gate: { min_scored_days: MIN_SCORED_DAYS },
    count: towns.length,
    towns: towns.map((t) => ({
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
