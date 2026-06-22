import { describe, it, expect } from "vitest";
import { heroStats } from "@/lib/homeStats";

const scores = {
  entries: [],
  totals: {
    openmeteo: { right: 105, wrong: 0, meh: 2, total_score: 9800.8, days: 107 },
    apple_weather: { right: 102, wrong: 0, meh: 2, total_score: 9545.7, days: 104 },
    raysweather: { right: 46, wrong: 29, meh: 32, total_score: 7556.6, days: 107 },
  },
};

describe("heroStats", () => {
  it("returns labeled per-source stats ordered free-first, then Ray's", () => {
    const h = heroStats(scores);
    expect(h.sources.map((s) => s.key)).toEqual(["openmeteo", "apple_weather", "raysweather"]);
    expect(h.sources[0]).toMatchObject({ label: "Open-Meteo", isFree: true, record: "105–0–2" });
    expect(h.sources[0].avg).toBeCloseTo(91.6, 1);
  });
  it("derives tracked days, dead-last count, and the free-vs-Ray's point gap", () => {
    const h = heroStats(scores);
    expect(h.trackedDays).toBe(107);
    expect(h.deadLastDays).toBe(29);
    expect(h.bestFree?.key).toBe("apple_weather");
    expect(h.pointGap).toBeCloseTo(21.2, 1);
  });
  it("handles null/empty scores without throwing", () => {
    expect(heroStats(null).sources).toEqual([]);
    expect(heroStats(null).pointGap).toBe(0);
  });
});
