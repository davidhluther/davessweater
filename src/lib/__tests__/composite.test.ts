import { describe, it, expect } from "vitest";
import { compositeForecast } from "@/lib/composite";
import type { LatestForecasts, ForecastDisplay } from "@/lib/types";

function src(high: number | null, low: number | null, precip: string | null = "none"): ForecastDisplay {
  return { label: "x", high_f: high, low_f: low, wind: null, precip_type: precip };
}

function latest(sources: Record<string, ForecastDisplay>): LatestForecasts {
  return { date: "2026-07-01", sources };
}

describe("compositeForecast", () => {
  it("returns null without at least two contributing highs and lows", () => {
    expect(compositeForecast(null)).toBeNull();
    expect(compositeForecast(latest({ openmeteo: src(80, 60) }))).toBeNull();
  });

  it("averages highs/lows and excludes raysweather + apple_weather", () => {
    const c = compositeForecast(latest({
      openmeteo: src(80, 60),
      nws: src(84, 64),
      raysweather: src(100, 0),
      apple_weather: src(100, 0),
    }));
    expect(c).not.toBeNull();
    expect(c!.high).toBe(82);
    expect(c!.low).toBe(62);
    expect(c!.count).toBe(2);
    expect(c!.sources.sort()).toEqual(["nws", "openmeteo"]);
  });

  it("exposes the raw majority precip key alongside the display label", () => {
    const c = compositeForecast(latest({
      openmeteo: src(80, 60, "rain"),
      nws: src(84, 64, "rain"),
      metno: src(82, 62, "none"),
    }));
    expect(c!.precip).toBe("rain");
    expect(c!.precipLabel).toBe("Rain likely");
  });

  it("defaults the precip key to none when no source states one", () => {
    const c = compositeForecast(latest({
      openmeteo: src(80, 60, null),
      nws: src(84, 64, null),
    }));
    expect(c!.precip).toBe("none");
    expect(c!.precipLabel).toBe("No precip");
  });
});
