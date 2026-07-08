import { describe, it, expect } from "vitest";
import { getForecast5Day, stripDays, type Forecast5Day } from "@/lib/forecast5";
import { sweaterFromEffective } from "@/lib/sweater";

function src(high: number | null, low: number | null, precip: string | null = "none", prob?: number) {
  return {
    label: "x", high_f: high, low_f: low, wind: null, precip_type: precip,
    ...(prob !== undefined ? { precip_prob: prob } : {}),
  };
}

function days(n: number): Forecast5Day["days"] {
  return Array.from({ length: n }, (_, i) => ({
    date: `2026-07-${String(10 + i).padStart(2, "0")}`,
    sources: { openmeteo: src(80, 60), nws: src(84, 64) },
  }));
}

const f5: Forecast5Day = {
  generated_at: "2026-07-08T04:48:46-04:00",
  location: "Boone",
  days: [
    {
      date: "2026-07-10",
      sources: {
        openmeteo: src(80, 60, "rain", 60),
        nws: src(84, 64, "rain"),
        metno: src(82, 62, "none", 30),
        // Excluded from the consensus (see src/lib/composite.ts) — its high
        // and its precip_prob must not leak into the strip.
        raysweather: src(100, 0, "rain", 99),
      },
    },
    // Only one contributing source → compositeForecast returns null → dropped.
    { date: "2026-07-11", sources: { openmeteo: src(78, 58) } },
    {
      date: "2026-07-12",
      sources: { openmeteo: src(40, 28), nws: src(44, 32) },
    },
  ],
};

describe("stripDays", () => {
  it("returns [] for missing data", () => {
    expect(stripDays(null)).toEqual([]);
  });

  it("maps days through the composite and drops days with <2 contributing sources", () => {
    const out = stripDays(f5);
    expect(out.map((d) => d.date)).toEqual(["2026-07-10", "2026-07-12"]);
    // mean(80, 84, 82) — raysweather's 100 excluded (86 would betray inclusion)
    expect(out[0].high).toBe(82);
    expect(out[0].low).toBe(62);
    expect(out[0].count).toBe(3);
    expect(out[0].precip).toBe("rain");
    expect(out[0].precipLabel).toBe("Rain likely");
  });

  it("labels each day with a short weekday and a short date", () => {
    const out = stripDays(f5);
    expect(out[0].weekday).toBe("Fri");
    expect(out[0].dayLabel).toBe("Jul 10");
    expect(out[1].weekday).toBe("Sun");
    expect(out[1].dayLabel).toBe("Jul 12");
  });

  it("precipProb is the max among contributing sources when any carries one, else omitted", () => {
    const out = stripDays(f5);
    // max(60, 30) — metno's "none" vote still contributes its prob;
    // raysweather's 99 is excluded with the source.
    expect(out[0].precipProb).toBe(60);
    expect(out[1].precipProb).toBeUndefined();
  });

  it("sweater verdict follows the published band of the composite high", () => {
    const out = stripDays(f5);
    expect(out[0].sweaters).toBe(0); // 82° — no sweater
    expect(out[1].sweaters).toBe(4); // 42° — classic sweater weather
    for (const d of out) expect(d.sweaters).toBe(sweaterFromEffective(d.high).score);
  });

  it("caps the strip at opts.max, defaulting to 6 days", () => {
    expect(stripDays(f5, { max: 1 }).map((d) => d.date)).toEqual(["2026-07-10"]);
    const wide: Forecast5Day = { generated_at: "", location: "Boone", days: days(8) };
    expect(stripDays(wide)).toHaveLength(6);
    expect(stripDays(wide, { max: 3 })).toHaveLength(3);
  });
});

// Pin the loader + types against the real committed artifact so schema drift
// on the Python side fails loudly here rather than silently blanking the strip
// (same guard idiom as leadtime.test.ts).
describe("real data/forecast_5day.json artifact", () => {
  it("loads and matches the contract shape", async () => {
    const real = await getForecast5Day();
    expect(real).not.toBeNull();
    expect(real!.location).toBe("Boone");
    expect(typeof real!.generated_at).toBe("string");
    expect(real!.days.length).toBeGreaterThan(0);
    for (const d of real!.days) {
      expect(d.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Object.keys(d.sources).length).toBeGreaterThan(0);
    }
  });

  it("yields at least two render-ready strip days", async () => {
    const out = stripDays(await getForecast5Day());
    expect(out.length).toBeGreaterThanOrEqual(2);
    for (const d of out) {
      expect(Number.isFinite(d.high)).toBe(true);
      expect(Number.isFinite(d.low)).toBe(true);
      expect(d.weekday).toBeTruthy();
      expect(d.sweaters).toBeGreaterThanOrEqual(0);
      expect(d.sweaters).toBeLessThanOrEqual(5);
      expect(d.count).toBeGreaterThanOrEqual(2);
    }
  });
});
