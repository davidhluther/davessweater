import { describe, it, expect } from "vitest";
import { buildForecast5FromCaptures, scoredDays, firstScoredDate, townTodayForecasts, weatherNavTowns } from "@/lib/towns";
import type { Forecast5Day } from "@/lib/forecast5";
import { compositeForecast } from "@/lib/composite";

describe("weatherNavTowns", () => {
  it("lists Boone first (routed to /), then the rest alphabetical with /weather hrefs", async () => {
    const nav = await weatherNavTowns();
    expect(nav.length).toBeGreaterThan(1);
    // Boone leads and keeps its legacy root URL.
    expect(nav[0]).toMatchObject({ slug: "boone", href: "/" });
    const others = nav.slice(1);
    // Every non-Boone town points at its /weather/{slug} page.
    for (const t of others) {
      expect(t.href).toBe(`/weather/${t.slug}`);
      expect(t.slug).not.toBe("boone");
    }
    // Alphabetical by name after Boone.
    const names = others.map((t) => t.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});

describe("scoredDays", () => {
  it("counts scoreboard entries, tolerating missing data", () => {
    expect(scoredDays(null)).toBe(0);
    expect(scoredDays({ entries: [{}, {}, {}], totals: {} })).toBe(3);
    expect(scoredDays({ entries: [], totals: {} })).toBe(0);
  });
});

describe("firstScoredDate", () => {
  it("returns the earliest scoreboard date regardless of entry order", () => {
    const scores = { totals: {}, entries: [
      { date: "2026-07-20" }, { date: "2026-07-18" }, { date: "2026-07-19" },
    ] };
    expect(firstScoredDate(scores)).toBe("2026-07-18");
  });
  it("returns null when there are no dated entries", () => {
    expect(firstScoredDate(null)).toBeNull();
    expect(firstScoredDate({ totals: {}, entries: [{}] })).toBeNull();
  });
});

describe("townTodayForecasts", () => {
  const f5: Forecast5Day = {
    generated_at: "2026-07-25T12:00:00",
    location: "Blowing Rock",
    days: [
      { date: "2026-07-25", sources: { openmeteo: { label: "Open-Meteo", high_f: 73, low_f: 62, wind: "10 mph", precip_type: "rain" } } },
      { date: "2026-07-26", sources: { openmeteo: { label: "Open-Meteo", high_f: 77, low_f: 64, wind: "11 mph", precip_type: "none" } } },
    ],
  };
  it("returns the first day on or after the clock, shaped as LatestForecasts", () => {
    const lf = townTodayForecasts(f5, "2026-07-26");
    expect(lf).not.toBeNull();
    expect(lf!.date).toBe("2026-07-26");
    expect(lf!.sources.openmeteo.high_f).toBe(77);
  });
  it("falls back to the first available day when all are in the past", () => {
    expect(townTodayForecasts(f5, "2026-08-01")!.date).toBe("2026-07-25");
  });
  it("tolerates a null or empty artifact", () => {
    expect(townTodayForecasts(null)).toBeNull();
    expect(townTodayForecasts({ generated_at: "", location: "", days: [] })).toBeNull();
  });
});

describe("buildForecast5FromCaptures", () => {
  const captures = [
    {
      source: "openmeteo",
      label: "Open-Meteo",
      daily: [
        { date: "2026-07-26", high_f: 77.5, low_f: 64.3, wind_mph: 11.4, precip_type: "rain", precip_prob: 34 },
        { date: "2026-07-25", high_f: 73.7, low_f: 62.6, wind_mph: 12.2, precip_type: "rain", precip_prob: 42 },
      ],
    },
    {
      source: "nws",
      label: "NWS",
      daily: [
        { date: "2026-07-25", high_f: 74.0, low_f: 60.0, wind_mph: 2.0, precip_type: "rain" },
      ],
    },
    {
      source: "raysweather",
      label: "Ray's Weather",
      daily: [{ date: "2026-07-25", high_f: 74, low_f: 61 }], // no wind/precip (Ray omits them)
    },
  ];
  const f5 = buildForecast5FromCaptures(captures, "Blowing Rock", "2026-07-25T12:00:00");

  it("pivots captures date-major and sorts ascending", () => {
    expect(f5.location).toBe("Blowing Rock");
    expect(f5.days.map((d) => d.date)).toEqual(["2026-07-25", "2026-07-26"]);
  });

  it("keys sources per day and formats wind as a string", () => {
    const day0 = f5.days[0].sources;
    expect(Object.keys(day0).sort()).toEqual(["nws", "openmeteo", "raysweather"]);
    expect(day0.openmeteo).toMatchObject({ label: "Open-Meteo", high_f: 73.7, low_f: 62.6, wind: "12 mph", precip_type: "rain", precip_prob: 42 });
    expect(day0.nws.wind).toBe("2 mph");
    // Ray's carries nulls where it published nothing (never a fabricated 0).
    expect(day0.raysweather).toMatchObject({ high_f: 74, low_f: 61, wind: null, precip_type: null });
  });

  it("feeds compositeForecast() unchanged (the consensus reads it)", () => {
    const day0 = { date: f5.days[0].date, generated_at: "", location: "", sources: f5.days[0].sources };
    const c = compositeForecast(day0);
    expect(c).not.toBeNull();
    // openmeteo 73.7 + nws 74.0 → mean 73.85 → rounds to 74 (Ray excluded).
    expect(c!.high).toBe(74);
    expect(c!.precip).toBe("rain");
  });
});
