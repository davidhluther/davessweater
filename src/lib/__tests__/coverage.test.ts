import { describe, it, expect } from "vitest";
import { coverageMatrix } from "@/lib/coverage";

const scores = { entries: [], totals: {}, coverage: {
  openmeteo:   { high_temp:{provided:474,days:474}, low_temp:{provided:474,days:474}, wind:{provided:474,days:474}, precip_type:{provided:474,days:474}, precip_amount:{provided:474,days:474} },
  raysweather: { high_temp:{provided:108,days:109}, low_temp:{provided:109,days:109}, wind:{provided:76,days:109},  precip_type:{provided:99,days:109},  precip_amount:{provided:0,days:109} },
} } as never;

describe("coverageMatrix", () => {
  it("returns v1 sources only, with labels and field order", () => {
    const m = coverageMatrix(scores);
    expect(m.map((r) => r.key)).toEqual(["openmeteo", "raysweather"]);
    expect(m[0].label).toBe("Open-Meteo");
    expect(m[0].cells.map((c) => c.field)).toEqual(["high_temp","low_temp","wind","precip_type","precip_amount"]);
  });
  it("classifies full / partial / omission and computes ratio", () => {
    const rays = coverageMatrix(scores)[1];
    const byField = Object.fromEntries(rays.cells.map((c) => [c.field, c]));
    expect(byField.precip_amount.kind).toBe("omission");
    expect(byField.precip_amount.ratio).toBe(0);
    expect(byField.wind.kind).toBe("partial");
    expect(byField.low_temp.kind).toBe("full");
    expect(byField.high_temp.kind).toBe("partial");
  });
});
