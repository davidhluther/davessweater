import { describe, it, expect } from "vitest";
import { sparkSeries, sparkPath } from "@/lib/sparkline";

const scores = { totals: {}, coverage: {}, entries: [
  { date: "2026-03-01", openmeteo: 90, raysweather: 60 },
  { date: "2026-03-02", openmeteo: 95 },                       // no rays → outside window
  { date: "2026-03-03", openmeteo: 80, raysweather: 40 },
] } as never;

describe("sparkSeries", () => {
  it("scopes to rays-present dates and returns aligned per-source values", () => {
    const s = sparkSeries(scores, ["openmeteo", "raysweather"]);
    expect(s.openmeteo).toEqual([90, 80]);   // 2026-03-02 dropped
    expect(s.raysweather).toEqual([60, 40]);
  });
});

describe("sparkPath", () => {
  it("maps values into a width x height box, top=high score", () => {
    const d = sparkPath([40, 100], 100, 20, 40, 100);
    expect(d).toBe("M0,20 L100,0");   // 40→bottom(y=20), 100→top(y=0)
  });
  it("returns empty string for <2 points", () => {
    expect(sparkPath([50], 100, 20)).toBe("");
  });
});
