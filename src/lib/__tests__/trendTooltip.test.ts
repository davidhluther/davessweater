import { describe, it, expect } from "vitest";
import { buildTooltipMap } from "@/lib/trendTooltip";

const comparisons = [{
  date: "2026-06-22",
  actuals: { high_f: 78.6, low_f: 59.8, wind_mph: 8.1, precip_in: 0.26 },
  sources: {
    openmeteo:   { score: { score: 98.3, breakdown: {} } },
    raysweather: { score: { score: 39.6, breakdown: {
      high_temp:     { points: 12, max: 30, scored: true, predicted: 84, actual: 78.6, error: 5.4 },
      precip_amount: { points: null, max: 10, scored: false, predicted: null, actual: 0.26, error: null, unit: "in_liquid" },
    } } },
  },
}] as never;

describe("buildTooltipMap", () => {
  it("keys by date with per-source scores and actual lines", () => {
    const m = buildTooltipMap(comparisons);
    expect(m["2026-06-22"].openmeteo).toBe(98.3);
    expect(m["2026-06-22"].rays).toBe(39.6);
    expect(m["2026-06-22"].actualLines[0]).toContain("Hi: 78.6");
  });
  it("includes scored Ray's misses and marks unpublished fields", () => {
    const misses = buildTooltipMap(comparisons)["2026-06-22"].rayMisses;
    const high = misses.find((x) => x.field === "high_temp")!;
    expect(high.published).toBe(true);
    expect(high.predicted).toBe(84);
    expect(high.error).toBe(5.4);
    const precip = misses.find((x) => x.field === "precip_amount")!;
    expect(precip.published).toBe(false);
  });
});
