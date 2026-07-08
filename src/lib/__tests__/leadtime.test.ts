import { describe, it, expect } from "vitest";
import {
  toChartSeries, compositeMemberMae, compositeMemberMaePair, decayChartSeries, warmBiasRange,
  getLeadtimeScores, type LeadtimeScores,
} from "@/lib/leadtime";

// Contract-legal fixture: cells only exist where n > 0 (Python never emits
// n=0 cells); metrics may be null when every group value was null.
const scores: LeadtimeScores = {
  location: "Boone", max_lead: 5,
  by_source: {
    openmeteo: { "0": { n: 5, avg_score: 91, high_mae: 1.9 }, "1": { n: 5, avg_score: 87, high_mae: 2.8 } },
    nws: { "0": { n: 3, avg_score: 85, high_mae: 2.5 }, "1": { n: 2, avg_score: 80, high_mae: 3.0 } },
    raysweather: { "0": { n: 5, avg_score: 71, high_mae: 4.1 }, "1": { n: 5, avg_score: null, high_mae: null } },
    apple_weather: { "0": { n: 5, avg_score: 50, high_mae: 99 } },
  },
};

describe("toChartSeries", () => {
  it("emits one series per source with (lead, value) points, skipping null cells, sorted by lead", () => {
    const series = toChartSeries(scores, "high_mae");
    const om = series.find((s) => s.source === "openmeteo")!;
    expect(om.points).toEqual([{ lead: 0, value: 1.9 }, { lead: 1, value: 2.8 }]);
    const ray = series.find((s) => s.source === "raysweather")!;
    expect(ray.points).toEqual([{ lead: 0, value: 4.1 }]); // null cell dropped
  });
  it("supports a minimum-n floor", () => {
    // nws lead-1 has non-null metrics, so only the n=2 < minN floor can drop it.
    const series = toChartSeries(scores, "avg_score", { minN: 3 });
    expect(series.find((s) => s.source === "nws")!.points).toEqual([{ lead: 0, value: 85 }]);
  });
});

describe("compositeMemberMae", () => {
  it("averages free members' high_mae at a lead, excluding raysweather/apple_weather, n = min of members", () => {
    const r = compositeMemberMae(scores, 0)!;
    expect(r.mae).toBe(2.2); // mean(1.9, 2.5) — apple_weather's 99 would wreck this if not excluded
    expect(r.n).toBe(3); // min(openmeteo 5, nws 3), not max or first
  });
  it("returns null when no member has data at that lead", () => {
    expect(compositeMemberMae(scores, 3)).toBeNull();
  });
});

describe("compositeMemberMaePair", () => {
  // The honesty property the strip footer needs: both sides of the day-1 vs
  // day-5 comparison are computed over the SAME member set, so a source that
  // exists at one lead but not the other can't skew either side.
  const pairScores: LeadtimeScores = {
    location: "Boone", max_lead: 5,
    by_source: {
      openmeteo: { "1": { n: 5, high_mae: 2.0 }, "5": { n: 4, high_mae: 4.0 } },
      metno: { "1": { n: 5, high_mae: 3.0 }, "5": { n: 4, high_mae: 5.0 } },
      // Has a lead-1 cell but NO lead-5 cell — must be excluded from BOTH
      // sides. If it leaked into side a, a.mae would be mean(2, 3, 9) = 4.7.
      weatherapi: { "1": { n: 5, high_mae: 9.0 } },
      // Non-members stay out even when present at both leads.
      raysweather: { "1": { n: 5, high_mae: 1.0 }, "5": { n: 5, high_mae: 1.0 } },
    },
  };

  it("intersects the member set: a source missing either lead is dropped from both sides", () => {
    const r = compositeMemberMaePair(pairScores, 1, 5)!;
    expect(r).not.toBeNull();
    expect(r.members).toBe(2); // openmeteo + metno only
    expect(r.a).toEqual({ mae: 2.5, n: 5 }); // mean(2, 3); min n at lead 1
    expect(r.b).toEqual({ mae: 4.5, n: 4 }); // mean(4, 5); min n at lead 5
  });

  it("returns null when the intersection is empty", () => {
    // The base fixture has no lead-5 member cells at all.
    expect(compositeMemberMaePair(scores, 0, 5)).toBeNull();
  });
});

describe("decayChartSeries", () => {
  const decayScores: LeadtimeScores = {
    location: "Boone", max_lead: 5,
    by_source: {
      openmeteo: { "0": { n: 30, avg_score: 92 }, "1": { n: 30, avg_score: 88 }, "2": { n: 30, avg_score: 85 } },
      raysweather: { "0": { n: 30, avg_score: 71 }, "1": { n: 30, avg_score: 70 }, "5": { n: 1, avg_score: 30 } },
      // Every cell under the n>=10 floor: the source must vanish from the
      // series list entirely, not linger as an empty ghost legend entry.
      newsource: { "0": { n: 3, avg_score: 99 }, "1": { n: 2, avg_score: 99 } },
    },
  };

  it("floors thin cells and drops all-thin sources entirely", () => {
    const series = decayChartSeries(decayScores)!;
    expect(series.map((s) => s.source).sort()).toEqual(["openmeteo", "raysweather"]);
    expect(series.find((s) => s.source === "raysweather")!.points).toEqual([
      { lead: 0, value: 71 }, { lead: 1, value: 70 }, // the n=1 lead-5 cell floored
    ]);
  });

  it("returns null when fewer than 2 sources have 2+ charted points", () => {
    const thin: LeadtimeScores = {
      location: "Boone", max_lead: 5,
      by_source: {
        openmeteo: { "0": { n: 30, avg_score: 92 }, "1": { n: 30, avg_score: 88 } },
        raysweather: { "0": { n: 30, avg_score: 71 } }, // 1 point: no decay line
      },
    };
    expect(decayChartSeries(thin)).toBeNull();
    expect(decayChartSeries(null)).toBeNull();
  });

  it("charts the real artifact: 2+ sources, no empty series, ray stops before lead 5", () => {
    return getLeadtimeScores().then((real) => {
      const series = decayChartSeries(real)!;
      expect(series).not.toBeNull();
      expect(series.length).toBeGreaterThanOrEqual(2);
      for (const s of series) expect(s.points.length).toBeGreaterThan(0);
      const ray = series.find((s) => s.source === "raysweather")!;
      expect(ray.points.length).toBeGreaterThanOrEqual(2);
      expect(ray.points.some((p) => p.lead === 5)).toBe(false);
    });
  });
});

describe("warmBiasRange", () => {
  it("returns min…max of high_bias across leads 0-4 when every populated lead runs warm", () => {
    const s: LeadtimeScores = {
      location: "Boone", max_lead: 5,
      by_source: {
        raysweather: {
          "0": { n: 20, high_bias: 3.5 }, "1": { n: 20, high_bias: 3.02 },
          "2": { n: 20, high_bias: 3.63 }, "3": { n: 20, high_bias: 3.4 },
          // Lead 5 must NOT widen the range: it sits outside the disclosed
          // 0-4 window (Ray's lead-5 sample is a single day).
          "5": { n: 1, high_bias: 99 },
        },
      },
    };
    expect(warmBiasRange(s, "raysweather")).toEqual({ min: 3.02, max: 3.63 });
  });

  it("omits gracefully: null for mixed-sign bias, missing source, or too few leads", () => {
    const mixed: LeadtimeScores = {
      location: "Boone", max_lead: 5,
      by_source: { raysweather: { "0": { n: 20, high_bias: 3.5 }, "1": { n: 20, high_bias: -0.2 } } },
    };
    // The sentence claims "warm at every horizon" — mixed-sign data must
    // suppress it rather than mislabel.
    expect(warmBiasRange(mixed, "raysweather")).toBeNull();
    expect(warmBiasRange(mixed, "nope")).toBeNull();
    expect(warmBiasRange(null, "raysweather")).toBeNull();
    const one: LeadtimeScores = {
      location: "Boone", max_lead: 5,
      by_source: { raysweather: { "0": { n: 20, high_bias: 3.5 } } },
    };
    expect(warmBiasRange(one, "raysweather")).toBeNull();
  });

  it("real artifact: Ray's warm bias is a plausible +2…+5°F band", async () => {
    const r = warmBiasRange(await getLeadtimeScores(), "raysweather")!;
    expect(r).not.toBeNull();
    // ≈ +3.0…+3.6 as of 2026-07; bands not pins, since the daily run shifts it.
    expect(r.min).toBeGreaterThan(2);
    expect(r.max).toBeLessThan(5);
    expect(r.min).toBeLessThanOrEqual(r.max);
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
    // >= because the daily pipeline re-aggregates and n grows append-only.
    expect(real!.by_source.openmeteo["0"].n).toBeGreaterThanOrEqual(489);
  });
  it("minN floor drops the thin raysweather lead-5 cell (n=1) from chart series", async () => {
    const real = (await getLeadtimeScores())!;
    const series = toChartSeries(real, "avg_score", { minN: 10 });
    const ray = series.find((s) => s.source === "raysweather")!;
    expect(ray).toBeDefined();
    expect(ray.points.length).toBeGreaterThan(0);
    // Assumes raysweather lead-5 stays rare (n < 10); if it ever accumulates,
    // this failing loudly is desired friction — revisit the floor deliberately.
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

  it("compositeMemberMaePair(1, 5) yields plausible same-member bands (n grows daily — no exact pins)", async () => {
    const real = (await getLeadtimeScores())!;
    const r = compositeMemberMaePair(real, 1, 5)!;
    expect(r).not.toBeNull();
    // As of 2026-07: a ≈ 2.9, b ≈ 2.8 over 6 common members (weatherapi and
    // googleweather stop at lead 2, so they sit out of BOTH sides).
    expect(r.members).toBeGreaterThanOrEqual(4);
    expect(r.a.mae).toBeGreaterThan(2);
    expect(r.a.mae).toBeLessThan(4);
    expect(r.b.mae).toBeGreaterThan(2);
    expect(r.b.mae).toBeLessThan(4.5);
    expect(r.a.n).toBeGreaterThan(0);
    expect(r.b.n).toBeGreaterThan(0);
  });
});
