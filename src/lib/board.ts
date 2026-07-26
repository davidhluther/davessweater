// Shared accuracy-board helpers — the pieces the Boone `/right-wrong-ray` page
// and every per-town `/right-wrong-ray/{slug}` board use so a town is graded and
// displayed on the byte-identical rubric as the flagship. Pure and unit-tested;
// the JSX day-card lives in components/ScoredDayCard.tsx and consumes these.

import type { Comparison, SourceEntry, Scores } from "@/lib/types";
import { FORECASTERS } from "@/lib/forecasters";

// Display metadata for sources that live outside the FORECASTERS index map.
// Ray's is the only one with a bill.
const EXTRA_META: Record<string, { label: string; iconSrc?: string; iconChar?: string }> = {
  raysweather: { label: "Ray's Weather", iconSrc: "/assets/ray_face.svg" },
  apple_weather: { label: "Apple Weather", iconChar: "📱" },
  composite: { label: "Dave's Sweater Index" },
};
const PRICES: Record<string, string> = { raysweather: "Paid" };

export interface SrcMeta { label: string; iconSrc?: string; iconChar?: string; price: string; }

export function srcMeta(key: string): SrcMeta {
  const f = FORECASTERS[key];
  const base = f ? { label: f.label, iconSrc: f.logo } : (EXTRA_META[key] ?? { label: key });
  return { ...base, price: PRICES[key] ?? "Free" };
}

export function predFields(e: SourceEntry): { hiLo: string; wind: string; rain: string } {
  const p = e.prediction;
  const hi = p.today_high_f ?? p.high_f, lo = p.tonight_low_f ?? p.low_f;
  const wind = p.wind_mph, rain = p.precip_in ?? p.rainfall_in;
  return {
    hiLo: `${hi ?? "—"}° / ${lo ?? "—"}°`,
    wind: wind != null ? `${Math.round(wind * 10) / 10} mph` : "—",
    rain: rain != null ? `${rain}"` : "—",
  };
}

// Score bars read by grade band: Right (75+) green, Meh slate, Wrong orange.
export function barColor(s: number): string {
  return s >= 75 ? "bg-green" : s >= 60 ? "bg-slate-400" : "bg-orange-600";
}

// Tie-break for the day leaderboard: the summed miss across the graded
// "show the math" fields (the closer forecast ranks higher).
export function missTotal(score: SourceEntry["score"]): number {
  let sum = 0, n = 0;
  for (const f of Object.values(score.breakdown ?? {})) {
    if (f.scored && typeof f.error === "number") { sum += Math.abs(f.error); n++; }
  }
  return n ? sum : Number.MAX_SAFE_INTEGER;
}

export interface ScoredSource extends SrcMeta {
  key: string;
  e: SourceEntry & { score: NonNullable<SourceEntry["score"]> };
}

// The day's scored sources, best first. The Dave's Sweater Index (composite) is
// featured on its own, never in this member leaderboard — it must not compete
// against the very sources it averages for "day's best". Ties break on the
// smaller summed miss, so best/worst each land on exactly one card.
export function sortScoredSources(comp: Comparison | null): ScoredSource[] {
  return Object.keys(comp?.sources ?? {})
    .filter((key) => key !== "composite")
    .map((key) => ({ key, ...srcMeta(key), e: comp!.sources![key]! }))
    .filter((s): s is ScoredSource => Boolean(s.e && s.e.score))
    .sort((x, y) =>
      y.e.score.score - x.e.score.score ||
      missTotal(x.e.score) - missTotal(y.e.score) ||
      x.label.localeCompare(y.label));
}

// Per-key sparkline series for a town scoreboard. Unlike the Boone sparkline
// (scoped to the Ray-era window), a town's series is scoped per source to the
// days that source itself was scored — so a town with no Ray's station still
// draws trend lines for the sources it does track.
export function townSparkSeries(scores: Scores | null, keys: string[]): Record<string, number[]> {
  const entries = (scores?.entries ?? [])
    .slice()
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const out = Object.fromEntries(keys.map((k) => [k, [] as number[]])) as Record<string, number[]>;
  for (const e of entries) {
    for (const k of keys) {
      const v = (e as Record<string, unknown>)[k];
      if (typeof v === "number") out[k].push(v);
    }
  }
  return out;
}
