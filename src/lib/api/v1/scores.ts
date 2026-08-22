// GET /api/v1/scores?town=
// The season scoreboard for a town: per-source average score and Right-Meh-Wrong
// record, plus the scored-day count. Shaped straight from scores.json for consumers.

import { jsonOk, jsonError } from "@/lib/apiResponse";
import { getTown, isTownPublic, publicSlugs, getTownScores, scoredDays } from "@/lib/towns";
import { scoreboardRows } from "@/lib/scoreboard";
import { isProvisional } from "@/lib/gating";

export async function scores(request: Request): Promise<Response> {
  const sp = new URL(request.url).searchParams;
  const slug = sp.get("town") || "boone";

  if (!(await isTownPublic(slug))) {
    return jsonError(404, `Unknown or not-yet-tracked town: "${slug}"`, {
      valid_towns: await publicSlugs(),
    });
  }
  const town = await getTown(slug);
  const scores = await getTownScores(slug);
  const totals = scores?.totals ?? {};

  const sources = scoreboardRows(scores).map((r) => {
    const t = totals[r.key];
    return {
      key: r.key,
      label: r.label,
      avg: r.avg,
      days: r.days,
      right: t?.right ?? 0,
      meh: t?.meh ?? 0,
      wrong: t?.wrong ?? 0,
      record: r.record,
      provisional: isProvisional(r.days),
    };
  });

  return jsonOk({
    town: { slug, name: town?.name ?? slug },
    scored_days: scoredDays(scores),
    sources,
  });
}
