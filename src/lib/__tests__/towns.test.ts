import { describe, it, expect } from "vitest";
import { buildForecast5FromCaptures, scoredDays } from "@/lib/towns";
import { compositeForecast } from "@/lib/composite";

describe("scoredDays", () => {
  it("counts scoreboard entries, tolerating missing data", () => {
    expect(scoredDays(null)).toBe(0);
    expect(scoredDays({ entries: [{}, {}, {}], totals: {} })).toBe(3);
    expect(scoredDays({ entries: [], totals: {} })).toBe(0);
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
