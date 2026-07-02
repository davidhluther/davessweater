import { describe, it, expect } from "vitest";
import { otherSourcesRows } from "@/lib/scoreboard";
import { isProvisional, MIN_SCORED_DAYS } from "@/lib/gating";
import type { Scores } from "@/lib/types";

const T = (right: number, days: number, total: number) => ({ right, wrong: 0, meh: days - right, total_score: total, days });

const scores: Scores = {
  entries: [],
  totals: {
    // headline trio — excluded from "the rest of the field"
    openmeteo: T(480, 483, 44309.6),
    raysweather: T(47, 117, 8308.1),
    apple_weather: T(111, 115, 10587.1),
    // the field
    googleweather: T(8, 8, 760.8),   // 95.1, provisional (8 < 14)
    metno: T(8, 8, 760.0),           // 95.0, provisional
    nws: T(30, 40, 3284.0),          // 82.1, ranked (40 >= 14)
  },
};

describe("otherSourcesRows", () => {
  const rows = otherSourcesRows(scores);

  it("excludes the headline trio (openmeteo/raysweather/apple_weather)", () => {
    const keys = rows.map((r) => r.key);
    expect(keys).not.toContain("openmeteo");
    expect(keys).not.toContain("raysweather");
    expect(keys).not.toContain("apple_weather");
    expect(keys.sort()).toEqual(["googleweather", "metno", "nws"]);
  });

  it("labels every field source as free and carries its average + record", () => {
    const nws = rows.find((r) => r.key === "nws")!;
    expect(nws.isFree).toBe(true);
    expect(nws.label).toBe("National Weather Service");
    expect(nws.avg).toBeCloseTo(82.1, 1);
    expect(nws.record).toBe("30W - 10M - 0L");
  });

  it("flags sources under MIN_SCORED_DAYS as provisional, not those at or above", () => {
    expect(rows.find((r) => r.key === "metno")!.provisional).toBe(true);
    expect(rows.find((r) => r.key === "nws")!.provisional).toBe(false);
  });

  it("orders by the FORECASTERS display order (nws before metno before google)", () => {
    expect(rows.map((r) => r.key)).toEqual(["nws", "metno", "googleweather"]);
  });

  it("returns [] when there are no totals", () => {
    expect(otherSourcesRows(null)).toEqual([]);
    expect(otherSourcesRows({ entries: [], totals: {} })).toEqual([]);
  });
});

describe("gating", () => {
  it("isProvisional is true strictly below MIN_SCORED_DAYS", () => {
    expect(isProvisional(MIN_SCORED_DAYS - 1)).toBe(true);
    expect(isProvisional(MIN_SCORED_DAYS)).toBe(false);
  });
});
