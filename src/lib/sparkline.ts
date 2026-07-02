import type { Scores } from "@/lib/types";

// Any tracked source key works; the series stays scoped to the Ray-era window
// (entries where a raysweather score exists) so every sparkline shares an axis.
type Key = string;

export function sparkSeries(scores: Scores | null, keys: Key[]): Record<Key, number[]> {
  const entries = (scores?.entries ?? [])
    .filter((e) => typeof (e as Record<string, unknown>).raysweather === "number")
    .slice()
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const out = Object.fromEntries(keys.map((k) => [k, [] as number[]])) as Record<Key, number[]>;
  for (const e of entries) {
    for (const k of keys) {
      const v = (e as Record<string, unknown>)[k];
      if (typeof v === "number") out[k].push(v);
    }
  }
  return out;
}

// Trailing mean over up to `w` days — the scoreboard sparklines smooth with
// this so the line reads as a trend, not daily noise (same 7-day treatment as
// the homepage chart's default view). Works for any series length ≥ 2.
export function rollingMean(values: number[], w = 7): number[] {
  return values.map((_, i) => {
    const win = values.slice(Math.max(0, i - w + 1), i + 1);
    return win.reduce((a, b) => a + b, 0) / win.length;
  });
}

export function sparkPath(values: number[], width: number, height: number, min = 40, max = 100): string {
  if (values.length < 2) return "";
  const span = values.length - 1;
  const x = (i: number) => Math.round((i / span) * width);
  const y = (v: number) => Math.round((1 - (Math.min(max, Math.max(min, v)) - min) / (max - min)) * height);
  return values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
}
