import { describe, it, expect } from "vitest";
import { toChartSeries, compositeMemberMae, getLeadtimeScores, type LeadtimeScores } from "@/lib/leadtime";

const scores = {
  location: "Boone", max_lead: 5,
  by_source: {
    openmeteo: { "0": { n: 5, avg_score: 91, high_mae: 1.9 }, "1": { n: 5, avg_score: 87, high_mae: 2.8 } },
    nws: { "0": { n: 5, avg_score: 85, high_mae: 2.5 } },
    raysweather: { "0": { n: 5, avg_score: 71, high_mae: 4.1 }, "1": { n: 0, avg_score: null, high_mae: null } },
  },
} as unknown as LeadtimeScores;

describe("toChartSeries", () => {
  it("emits one series per source with (lead, value) points, skipping null cells, sorted by lead", () => {
    const series = toChartSeries(scores, "high_mae");
    const om = series.find((s) => s.source === "openmeteo")!;
    expect(om.points).toEqual([{ lead: 0, value: 1.9 }, { lead: 1, value: 2.8 }]);
    const ray = series.find((s) => s.source === "raysweather")!;
    expect(ray.points).toEqual([{ lead: 0, value: 4.1 }]); // null cell dropped
  });
  it("supports a minimum-n floor", () => {
    const series = toChartSeries(scores, "avg_score", { minN: 5 });
    expect(series.find((s) => s.source === "raysweather")!.points).toHaveLength(1);
  });
});

describe("compositeMemberMae", () => {
  it("averages free members' high_mae at a lead, excluding raysweather/apple_weather, n = min of members", () => {
    const r = compositeMemberMae(scores, 0)!;
    expect(r.mae).toBe(2.2); // mean(1.9, 2.5)
    expect(r.n).toBe(5);
  });
  it("returns null when no member has data at that lead", () => {
    expect(compositeMemberMae(scores, 3)).toBeNull();
  });
});

// Pin the TS types against the real committed artifact so schema drift on the
// Python side fails loudly here rather than silently mis-rendering the site.
describe("real data/leadtime_scores.json artifact", () => {
  it("loads and matches the contract shape and known values", async () => {
    const real = await getLeadtimeScores();
    expect(real).not.toBeNull();
    expect(real!.location).toBe("Boone");
    expect(real!.max_lead).toBe(5);
    expect(real!.by_source.openmeteo["0"].n).toBe(489);
  });
  it("minN floor drops the thin raysweather lead-5 cell (n=1) from chart series", async () => {
    const real = (await getLeadtimeScores())!;
    const series = toChartSeries(real, "avg_score", { minN: 10 });
    const ray = series.find((s) => s.source === "raysweather")!;
    expect(ray).toBeDefined();
    expect(ray.points.length).toBeGreaterThan(0);
    expect(ray.points.some((p) => p.lead === 5)).toBe(false);
  });
  it("compositeMemberMae at lead 1 is a plausible degrees-F error", async () => {
    const real = (await getLeadtimeScores())!;
    const r = compositeMemberMae(real, 1);
    expect(r).not.toBeNull();
    expect(r!.mae).toBeGreaterThan(2);
    expect(r!.mae).toBeLessThan(4);
    expect(r!.n).toBeGreaterThan(0);
  });
});
