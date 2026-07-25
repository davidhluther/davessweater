// GET /api/v1/forecast?town=&days=1|3|5&detail=summary|full
// The consensus (Dave's Sweater Index) forecast for a town, N days out.
//
// Vercel data-tracing: this handler reads committed data/ JSON at request time.
// It uses searchParams, so it CANNOT be `force-static` (force-static can't read
// query params) — it is dynamic, and next.config.ts's outputFileTracingIncludes
// ships data/**/*.json into the serverless bundle so the reads resolve in the
// Lambda. See the note in next.config.ts.
export const dynamic = "force-dynamic";

import { jsonOk, jsonError, corsPreflight } from "@/lib/apiResponse";
import { parseDays, parseDetail, toApiDay, type ApiSourceRow } from "@/lib/publicFeed";
import { getTown, isTownPublic, publicSlugs, getTownForecast5 } from "@/lib/towns";
import { stripDays } from "@/lib/forecast5";

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
  const days = parseDays(sp.get("days"));
  if (!days.ok) return jsonError(400, days.error);
  const detail = parseDetail(sp.get("detail"));
  if (!detail.ok) return jsonError(400, detail.error);

  const town = await getTown(slug);
  const f5 = await getTownForecast5(slug);
  const strip = stripDays(f5, { max: days.value });
  const byDate = new Map((f5?.days ?? []).map((d) => [d.date, d.sources]));

  const forecast = strip.map((d) => {
    const day = toApiDay(d);
    if (detail.value === "full") {
      const src = byDate.get(d.date) ?? {};
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
      day.sources = rows;
    }
    return day;
  });

  return jsonOk({
    town: { slug, name: town?.name ?? slug },
    days: days.value,
    detail: detail.value,
    generated_at: f5?.generated_at ?? null,
    forecast,
  });
}
