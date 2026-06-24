import { describe, it, expect } from "vitest";
import { heroStats } from "@/lib/homeStats";

const scores = {
  entries: [],
  totals: {
    openmeteo: { right: 105, wrong: 0, meh: 2, total_score: 9800.8, days: 107 },
    apple_weather: { right: 102, wrong: 0, meh: 2, total_score: 9545.7, days: 104 },
    raysweather: { right: 46, wrong: 29, meh: 32, total_score: 7556.6, days: 107 },
  },
};

// Scores fixture with entries for tracking-period tests
const scoresWithEntries = {
  totals: {
    openmeteo: { right: 465, wrong: 1, meh: 8, total_score: 43378.4, days: 474 },
    apple_weather: { right: 100, wrong: 0, meh: 4, total_score: 9500.0, days: 104 },
    raysweather: { right: 46, wrong: 29, meh: 32, total_score: 7556.6, days: 107 },
  },
  entries: [
    // Tracking day 1: raysweather present, free sources both score well
    { date: "2025-03-01", openmeteo: 91.6, apple_weather: 100, raysweather: 63.2 },
    // Tracking day 2: raysweather present, apple_weather scores below 60 (wrong in tracking)
    { date: "2025-03-02", openmeteo: 80.0, apple_weather: 55.0, raysweather: 50.0 },
    // Tracking day 3: raysweather present, raysweather scores below 60 (wrong)
    { date: "2025-03-03", openmeteo: 95.0, apple_weather: 90.0, raysweather: 40.0 },
    // Non-tracking day: raysweather absent (backfilled Open-Meteo only)
    { date: "2025-02-01", openmeteo: 88.0 },
  ],
};

describe("heroStats", () => {
  it("returns labeled per-source stats ordered free-first, then Ray's", () => {
    const h = heroStats(scores);
    expect(h.sources.map((s) => s.key)).toEqual(["openmeteo", "apple_weather", "raysweather"]);
    expect(h.sources[0]).toMatchObject({ label: "Open-Meteo", isFree: true, record: "105–0–2" });
    expect(h.sources[0].avg).toBeCloseTo(91.6, 1);
  });
  it("derives tracked days, graded-Wrong count, and the free-vs-Ray's point gap", () => {
    const h = heroStats(scores);
    expect(h.trackedDays).toBe(107);
    expect(h.raysWrongDays).toBe(29);
    expect(h.bestFree?.key).toBe("apple_weather");
    expect(h.pointGap).toBeCloseTo(21.2, 1);
  });
  it("handles null/empty scores without throwing", () => {
    expect(heroStats(null).sources).toEqual([]);
    expect(heroStats(null).pointGap).toBe(0);
  });
});

import { trendSeries } from "@/lib/homeStats";

describe("trendSeries", () => {
  it("scopes to the head-to-head window (rays-present dates), free null when openmeteo missing", () => {
    const s = { entries: [
      { date: "2026-06-19", openmeteo: 96.3, raysweather: 63.2 },
      { date: "2026-06-18", raysweather: 50 },          // rays present, no openmeteo → free null
      { date: "2026-06-17", openmeteo: 83.7 },          // rays absent → dropped (outside tracking window)
    ], totals: {} };
    expect(trendSeries(s)).toEqual([
      { date: "2026-06-18", free: null, rays: 50 },
      { date: "2026-06-19", free: 96.3, rays: 63.2 },
    ]);
  });
});

describe("heroStats — tracking-period stats", () => {
  it("counts only entries where raysweather is a number", () => {
    const h = heroStats(scoresWithEntries);
    expect(h.trackingDays).toBe(3); // 3 entries have raysweather; 1 non-tracking entry excluded
  });

  it("trackingFreeNeverWrong is false when a free source scored wrong in tracking period", () => {
    const h = heroStats(scoresWithEntries);
    // apple_weather scored 55.0 on 2025-03-02, which is <60 → wrong
    expect(h.trackingFreeNeverWrong).toBe(false);
  });

  it("trackingFreeNeverWrong is true when no free source has a wrong in tracking period", () => {
    const allGoodEntries = {
      totals: scoresWithEntries.totals,
      entries: [
        { date: "2025-03-01", openmeteo: 91.6, apple_weather: 100, raysweather: 63.2 },
        { date: "2025-03-02", openmeteo: 80.0, apple_weather: 75.0, raysweather: 50.0 },
      ],
    };
    const h = heroStats(allGoodEntries);
    expect(h.trackingFreeNeverWrong).toBe(true);
  });

  it("openmeteoFull reflects the full totals (474-day record)", () => {
    const h = heroStats(scoresWithEntries);
    expect(h.openmeteoFull).not.toBeNull();
    expect(h.openmeteoFull?.days).toBe(474);
    expect(h.openmeteoFull?.wrong).toBe(1);
    expect(h.openmeteoFull?.record).toBe("465–1–8");
  });

  it("trackingSources are in order: openmeteo, apple_weather, raysweather", () => {
    const h = heroStats(scoresWithEntries);
    expect(h.trackingSources.map((s) => s.key)).toEqual(["openmeteo", "apple_weather", "raysweather"]);
  });

  it("trackingRaysWrong counts Ray's wrong grades in the tracking period", () => {
    const h = heroStats(scoresWithEntries);
    // raysweather: 63.2 (meh), 50.0 (wrong), 40.0 (wrong) → 2 wrong
    expect(h.trackingRaysWrong).toBe(2);
  });

  it("handles null/empty scores without throwing for new tracking fields", () => {
    const h = heroStats(null);
    expect(h.trackingDays).toBe(0);
    expect(h.trackingSources).toEqual([]);
    expect(h.trackingRays).toBeNull();
    expect(h.trackingBestFree).toBeNull();
    expect(h.trackingPointGap).toBe(0);
    expect(h.trackingFreeNeverWrong).toBe(true);
    expect(h.trackingRaysWrong).toBe(0);
    expect(h.openmeteoFull).toBeNull();
  });
});

import { headToHead } from "@/lib/homeStats";

describe("headToHead", () => {
  it("pulls Dave's (openmeteo) vs Ray's scores and actual lines", () => {
    const comp = {
      date: "2026-06-20",
      actuals: { high_f: 84, low_f: 61, wind_mph: 6.2, precip_in: 0 },
      sweater_weather: {},
      sources: {
        openmeteo: { prediction: {}, score: { score: 100, grade: { verdict: "Right", ray_count: 5 }, breakdown: {} } },
        raysweather: { prediction: {}, score: { score: 51.6, grade: { verdict: "Wrong", ray_count: 2 }, breakdown: {} } },
      },
    };
    const h = headToHead(comp as never);
    expect(h).toMatchObject({ date: "2026-06-20", dave: 100, rays: 51.6 });
    expect(h?.actualLines[0]).toBe("Hi: 84° / Lo: 61°");
  });
  it("returns null for null comparison", () => {
    expect(headToHead(null)).toBeNull();
  });
});
