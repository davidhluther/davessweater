import { describe, it, expect } from "vitest";
import {
  srcMeta, predFields, barColor, missTotal, sortScoredSources, townSparkSeries,
} from "@/lib/board";
import type { Comparison, SourceEntry } from "@/lib/types";

const entry = (score: number, opts: Partial<SourceEntry["prediction"]> = {}, breakdown = {}): SourceEntry => ({
  prediction: { high_f: 70, low_f: 55, wind_mph: 8, precip_in: 0.1, ...opts },
  score: { score, grade: { verdict: "", ray_count: 0 }, breakdown },
});

describe("srcMeta", () => {
  it("labels indexed forecasters with a free price and a logo", () => {
    const m = srcMeta("openmeteo");
    expect(m.label).toBe("Open-Meteo");
    expect(m.price).toBe("Free");
    expect(m.iconSrc).toContain("openmeteo");
  });
  it("prices Ray's as Paid with the ray face", () => {
    const m = srcMeta("raysweather");
    expect(m.label).toBe("Ray's Weather");
    expect(m.price).toBe("Paid");
    expect(m.iconSrc).toContain("ray_face");
  });
  it("labels the composite as the Dave's Sweater Index", () => {
    expect(srcMeta("composite").label).toBe("Dave's Sweater Index");
  });
  it("falls back to the raw key for an unknown source", () => {
    expect(srcMeta("mystery").label).toBe("mystery");
  });
});

describe("predFields", () => {
  it("formats hi/lo, wind, and rain", () => {
    const f = predFields(entry(90));
    expect(f.hiLo).toBe("70° / 55°");
    expect(f.wind).toBe("8 mph");
    expect(f.rain).toBe('0.1"');
  });
  it("prefers today_high_f / tonight_low_f and shows dashes for blanks", () => {
    const f = predFields(entry(90, { high_f: undefined, low_f: undefined, wind_mph: undefined, precip_in: undefined, today_high_f: 72, tonight_low_f: 50 }));
    expect(f.hiLo).toBe("72° / 50°");
    expect(f.wind).toBe("—");
    expect(f.rain).toBe("—");
  });
});

describe("barColor", () => {
  it("greens Right, slates Meh, oranges Wrong", () => {
    expect(barColor(80)).toBe("bg-green");
    expect(barColor(65)).toBe("bg-slate-400");
    expect(barColor(40)).toBe("bg-orange-600");
  });
});

describe("missTotal", () => {
  it("sums absolute error over scored fields", () => {
    const s = entry(90, {}, {
      high_temp: { points: 30, max: 30, scored: true, error: 1 },
      low_temp: { points: 24, max: 30, scored: true, error: -2 },
      wind: { points: 20, max: 20, scored: false, error: 5 },
    }).score;
    expect(missTotal(s)).toBe(3);
  });
  it("returns a large sentinel when nothing is scored", () => {
    expect(missTotal(entry(0).score)).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe("sortScoredSources", () => {
  const comp: Comparison = {
    date: "2026-07-24",
    actuals: {},
    sweater_weather: {},
    sources: {
      openmeteo: entry(88),
      raysweather: entry(60),
      composite: entry(99), // excluded — featured on its own
      metno: undefined,     // unscored — dropped
    },
  };
  const out = sortScoredSources(comp);

  it("excludes the composite and drops unscored sources", () => {
    expect(out.map((s) => s.key)).toEqual(["openmeteo", "raysweather"]);
  });
  it("sorts best score first", () => {
    expect(out[0].key).toBe("openmeteo");
    expect(out[0].e.score.score).toBe(88);
  });
  it("tolerates a null comparison", () => {
    expect(sortScoredSources(null)).toEqual([]);
  });
});

describe("townSparkSeries", () => {
  it("collects each key's scores in date order, ignoring missing days", () => {
    const scores = {
      totals: {},
      entries: [
        { date: "2026-07-20", openmeteo: 80 },
        { date: "2026-07-18", openmeteo: 70, raysweather: 60 },
        { date: "2026-07-19", raysweather: 65 },
      ],
    };
    const out = townSparkSeries(scores, ["openmeteo", "raysweather"]);
    expect(out.openmeteo).toEqual([70, 80]);
    expect(out.raysweather).toEqual([60, 65]);
  });
  it("does not require a Ray's window (no-Ray towns still trend)", () => {
    const scores = { totals: {}, entries: [{ date: "2026-07-18", openmeteo: 90 }] };
    expect(townSparkSeries(scores, ["openmeteo"]).openmeteo).toEqual([90]);
  });
});
