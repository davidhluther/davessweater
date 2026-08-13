// Served by the src/app/api/v1/[...path] catch-all, not its own route file:
// each route directory would cost a Serverless Function against the Vercel
// Hobby cap of 12. Public URL is unchanged. See src/lib/ogStatic.ts + CHECKLIST.md.
// Handler for GET /api/v1/today?town=&detail=summary|full
// Today's Dave's Sweater Index consensus for a town (the first forecast day).

import { jsonOk, jsonError } from "@/lib/apiResponse";
import { parseDetail, toApiDay, type ApiSourceRow } from "@/lib/publicFeed";
import { getTown, isTownPublic, publicSlugs, getTownForecast5 } from "@/lib/towns";
import { stripDays } from "@/lib/forecast5";

export async function today(request: Request) {
  const sp = new URL(request.url).searchParams;
  const slug = sp.get("town") || "boone";

  if (!(await isTownPublic(slug))) {
    return jsonError(404, `Unknown or not-yet-tracked town: "${slug}"`, {
      valid_towns: await publicSlugs(),
    });
  }
  const detail = parseDetail(sp.get("detail"));
  if (!detail.ok) return jsonError(400, detail.error);

  const town = await getTown(slug);
  const f5 = await getTownForecast5(slug);
  const [first] = stripDays(f5, { max: 1 });

  if (!first) {
    return jsonError(404, `No current forecast available for "${slug}"`);
  }
  const today = toApiDay(first);
  if (detail.value === "full") {
    const src = (f5?.days ?? []).find((d) => d.date === first.date)?.sources ?? {};
    const rows: Record<string, ApiSourceRow> = {};
    for (const [key, v] of Object.entries(src)) {
      rows[key] = {
        label: v.label,
        high_f: v.high_f,
        low_f: v.low_f,
        wind: v.wind,
        precip_type: v.precip_type,
        ...(typeof v.precip_prob === "number" ? { precip_chance: v.precip_prob } : {}),
      };
    }
    today.sources = rows;
  }

  return jsonOk({
    town: { slug, name: town?.name ?? slug },
    detail: detail.value,
    generated_at: f5?.generated_at ?? null,
    today,
  });
}
