import { describe, it, expect } from "vitest";
import { sourceLabel, sourceIsFree, precipLabel } from "@/lib/townDisplay";
import { sparkSeries } from "@/lib/sparkline";

describe("sourceLabel", () => {
  it("maps forecaster ids to their display labels", () => {
    expect(sourceLabel("openmeteo")).toBe("Open-Meteo");
    expect(sourceLabel("nws")).toBe("National Weather Service");
    expect(sourceLabel("raysweather")).toBe("Ray's Weather");
    expect(sourceLabel("composite")).toBe("Dave's Sweater Index");
  });
  it("falls back to the raw key for an unknown source", () => {
    expect(sourceLabel("mystery")).toBe("mystery");
  });
});

describe("sourceIsFree", () => {
  it("marks every source free except the one with a bill", () => {
    expect(sourceIsFree("openmeteo")).toBe(true);
    expect(sourceIsFree("raysweather")).toBe(false);
  });
});

describe("precipLabel", () => {
  it("labels precip types, reading none as a dry day", () => {
    expect(precipLabel("rain")).toBe("Rain");
    expect(precipLabel("none")).toBe("No precip");
    expect(precipLabel(null)).toBe("—");
  });
});

describe("sparkSeries requireRays option", () => {
  const scores = { totals: {}, coverage: {}, entries: [
    { date: "2026-07-01", openmeteo: 90, raysweather: 60 },
    { date: "2026-07-02", openmeteo: 95 },                 // no rays row (a no-Ray town's day)
    { date: "2026-07-03", openmeteo: 80, raysweather: 40 },
  ] } as never;

  it("defaults to the Ray-era window (backward compatible)", () => {
    expect(sparkSeries(scores, ["openmeteo"]).openmeteo).toEqual([90, 80]);
  });

  it("includes every day when requireRays is false (no-Ray towns still trend)", () => {
    expect(sparkSeries(scores, ["openmeteo"], { requireRays: false }).openmeteo).toEqual([90, 95, 80]);
  });
});
