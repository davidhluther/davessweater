import { describe, it, expect } from "vitest";
import { compositeForecast, compositePrecipType } from "@/lib/composite";
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

  it("exposes the raw precip key alongside the display label", () => {
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

  it("only lets contributing sources (with a published high) vote on precip", () => {
    const c = compositeForecast(latest({
      openmeteo: src(80, 60, "none"),
      nws: src(84, 64, "none"),
      metno: src(null, 62, "snow"),
      weatherapi: src(null, 63, "snow"),
      tomorrowio: src(null, 61, "snow"),
    }));
    expect(c!.precip).toBe("none");
  });

  it("needs a credible minority (2+ callers): a lone precip caller stays none", () => {
    const c = compositeForecast(latest({
      openmeteo: src(80, 60, "rain"),
      nws: src(84, 64, "none"),
    }));
    expect(c!.precip).toBe("none"); // 1 of 2 callers < floor of 2
  });

  it("lets a credible minority call precip over a dry majority", () => {
    const c = compositeForecast(latest({
      openmeteo: src(80, 60, "rain"),
      nws: src(84, 64, "rain"),
      metno: src(82, 62, "none"),
      weatherapi: src(83, 63, "none"),
      tomorrowio: src(81, 61, "none"),
      googleweather: src(82, 62, "none"),
    }));
    expect(c!.precip).toBe("rain"); // 2 of 6 call rain -> rain
  });

  it("reads a rain/snow split among callers as mixed", () => {
    const c = compositeForecast(latest({
      openmeteo: src(30, 20, "rain"),
      nws: src(32, 22, "snow"),
    }));
    expect(c!.precip).toBe("mixed");
    expect(c!.precipLabel).toBe("Wintry mix");
  });
});

describe("compositePrecipType", () => {
  it("floors the caller count at 2 and scales to a quarter of contributors", () => {
    expect(compositePrecipType(["rain", "none"])).toBe("none"); // 1 < 2
    expect(compositePrecipType(["rain", "rain", "none", "none"])).toBe("rain"); // 2 of 4
    // 8 contributors -> needed = 2; two callers clear it.
    expect(compositePrecipType(["rain", "rain", ...Array(6).fill("none")])).toBe("rain");
  });
  it("reads snow-only callers as snow, but ANY rain/snow split as mixed", () => {
    expect(compositePrecipType(["snow", "snow"])).toBe("snow");
    expect(compositePrecipType(["rain", "snow"])).toBe("mixed");
    expect(compositePrecipType(["snow", "snow", "rain"])).toBe("mixed"); // lopsided split still mixed
    expect(compositePrecipType(["mixed", "rain"])).toBe("mixed"); // an explicit mixed caller (2 callers clear the floor)
    expect(compositePrecipType(["mixed", "none"])).toBe("none"); // lone caller below the floor of 2
  });
});
