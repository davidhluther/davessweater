import { describe, it, expect } from "vitest";
import {
  compositeForecast, compositePrecipType, precipChance, precipLabelFor, showsChance,
} from "@/lib/composite";
import type { LatestForecasts, ForecastDisplay } from "@/lib/types";

function src(
  high: number | null, low: number | null, precip: string | null = "none", prob?: number,
): ForecastDisplay {
  return {
    label: "x", high_f: high, low_f: low, wind: null, precip_type: precip,
    ...(prob !== undefined ? { precip_prob: prob } : {}),
  };
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

  it("publishes the median chance and its contributor count", () => {
    const c = compositeForecast(latest({
      openmeteo: src(80, 60, "rain", 80),
      nws: src(84, 64, "rain", 40),
      metno: src(82, 62, "rain"),          // publishes no chance — forfeits
      googleweather: src(83, 63, "rain", 30),
    }));
    expect(c!.precipProb).toBe(40);        // median(30, 40, 80)
    expect(c!.precipProbCount).toBe(3);    // metno is not counted
    expect(c!.count).toBe(4);              // …but it still feeds the temps
  });

  it("never lets Ray's or the Apple mirror leak a chance into our own number", () => {
    const c = compositeForecast(latest({
      openmeteo: src(80, 60, "rain", 30),
      nws: src(84, 64, "rain", 30),
      raysweather: src(100, 0, "rain", 99),
      apple_weather: src(100, 0, "rain", 99),
    }));
    expect(c!.precipProb).toBe(30);
    expect(c!.precipProbCount).toBe(2);
  });

  it("omits both chance fields when nobody publishes one", () => {
    const c = compositeForecast(latest({
      openmeteo: src(80, 60, "rain"),
      nws: src(84, 64, "rain"),
    }));
    expect(c!.precipProb).toBeUndefined();
    expect(c!.precipProbCount).toBeUndefined();
  });
});

describe("precipChance", () => {
  it("returns null when nobody published a chance", () => {
    expect(precipChance([])).toBeNull();
    expect(precipChance([undefined, null])).toBeNull();
  });

  it("passes a single source's number through unchanged", () => {
    expect(precipChance([70])).toEqual({ pct: 70, count: 1 });
    expect(precipChance([70, undefined, null])).toEqual({ pct: 70, count: 1 });
  });

  it("takes the middle value on an odd count, ignoring an outlier", () => {
    // The old max rule would have published 90 off one loud forecast.
    expect(precipChance([10, 20, 90])).toEqual({ pct: 20, count: 3 });
    expect(precipChance([90, 20, 10])).toEqual({ pct: 20, count: 3 }); // order-independent
  });

  it("averages the two middle values on an even count", () => {
    // Taking the upper middle would make n=2 the max all over again.
    expect(precipChance([10, 70])).toEqual({ pct: 40, count: 2 });
    expect(precipChance([10, 30, 50, 90])).toEqual({ pct: 40, count: 4 });
  });

  it("rounds the median to a whole percent", () => {
    expect(precipChance([40, 45])).toEqual({ pct: 43, count: 2 }); // 42.5
  });

  it("is materially calmer than the max it replaced", () => {
    const probs = [5, 10, 10, 15, 80];
    expect(precipChance(probs)!.pct).toBe(10);
    expect(Math.max(...probs)).toBe(80);
  });

  it("clamps out-of-range values rather than dropping the forecast", () => {
    expect(precipChance([120, 120, 120])).toEqual({ pct: 100, count: 3 });
    expect(precipChance([-40, -40])).toEqual({ pct: 0, count: 2 });
  });

  it("keeps genuine zeros — 0% is a forecast, absence is not", () => {
    expect(precipChance([0, 0, 60])).toEqual({ pct: 0, count: 3 });
  });

  it("ignores NaN and non-finite junk", () => {
    expect(precipChance([NaN, Infinity, 50])).toEqual({ pct: 50, count: 1 });
  });
});

describe("precipLabelFor", () => {
  it("keeps the likelihood word when there is no number to print", () => {
    expect(precipLabelFor("rain", false)).toBe("Rain likely");
  });

  it("drops it when a chance prints beside it, so the line can't argue with itself", () => {
    // The type call and the chance are independent, so "Rain likely | 9% chance"
    // is reachable in production. "Rain | 9% chance" is the same facts, coherent.
    expect(precipLabelFor("rain", true)).toBe("Rain");
  });

  it("leaves the labels that never asserted a likelihood alone", () => {
    for (const withChance of [true, false]) {
      expect(precipLabelFor("snow", withChance)).toBe("Snow");
      expect(precipLabelFor("mixed", withChance)).toBe("Wintry mix");
      expect(precipLabelFor("none", withChance)).toBe("No precip");
      expect(precipLabelFor("hail", withChance)).toBe("hail"); // unknown key passes through
    }
  });
});

describe("showsChance", () => {
  it("prints a real chance and stays quiet at zero or absent", () => {
    expect(showsChance(8)).toBe(true);
    expect(showsChance(100)).toBe(true);
    expect(showsChance(0)).toBe(false);
    expect(showsChance(undefined)).toBe(false);
    expect(showsChance(null)).toBe(false);
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
