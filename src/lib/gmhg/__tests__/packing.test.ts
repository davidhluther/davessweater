import { describe, it, expect } from "vitest";
import { packingFor, STATIC_PACKING, ALWAYS_LINE, type DayForecast } from "@/lib/gmhg/packing";

const base: DayForecast = { date: "2026-07-10", tempMaxF: 74, tempMinF: 62, precipProbMaxPct: 10, uvIndexMax: 4 };
const has = (s: string, needle: string) => s.toLowerCase().includes(needle);

describe("packingFor", () => {
  it("fails closed to static guidance when the forecast is missing", () => {
    expect(packingFor(null, false)).toBe(STATIC_PACKING);
  });

  it("always includes the Grandfather line", () => {
    expect(packingFor(base, false).includes(ALWAYS_LINE)).toBe(true);
  });

  it("recommends rain gear above the precip-probability threshold", () => {
    expect(has(packingFor({ ...base, precipProbMaxPct: 55 }, false), "raincoat")).toBe(true);
    expect(has(packingFor({ ...base, precipProbMaxPct: 15 }, false), "raincoat")).toBe(false);
  });

  it("recommends layers on a big temperature swing", () => {
    expect(has(packingFor({ ...base, tempMaxF: 78, tempMinF: 55 }, false), "layers")).toBe(true); // 23° swing
    expect(has(packingFor({ ...base, tempMaxF: 74, tempMinF: 66 }, false), "layers")).toBe(false); // 8° swing
  });

  it("recommends layers for early/late events even on a flat day", () => {
    expect(has(packingFor({ ...base, tempMaxF: 72, tempMinF: 66 }, true), "layers")).toBe(true);
  });

  it("recommends sunscreen on a high UV index", () => {
    expect(has(packingFor({ ...base, uvIndexMax: 8 }, false), "sunscreen")).toBe(true);
    expect(has(packingFor({ ...base, uvIndexMax: 3 }, false), "sunscreen")).toBe(false);
  });

  it("reads as a sentence, not choppy fragments", () => {
    const s = packingFor({ ...base, tempMaxF: 80, tempMinF: 58, precipProbMaxPct: 50, uvIndexMax: 8 }, false);
    expect(s.startsWith("Pack ")).toBe(true);
    expect(s).toContain(", and ");
  });
});
