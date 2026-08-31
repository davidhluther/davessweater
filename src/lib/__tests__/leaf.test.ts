import { describe, it, expect } from "vitest";
import {
  elevationBand, fmtPeakWindow, hasThermalSignal, lapseRatePerThousandFt,
  leafBandRows, leafBarPosition, leafBookends, leafByPeak, leafSeasonSpan,
  leafWindowIsCurrent, ridgeOffsetPhrase, type LeafPrediction,
} from "@/lib/leaf";

// Shaped like a real record out of scripts/predict_leaf.py. Boone's numbers,
// which is the one town whose window a reader is most likely to check by hand.
const boone = (over: Partial<LeafPrediction> = {}): LeafPrediction => ({
  slug: "boone",
  name: "Boone",
  elevation_ft: 3333,
  county: "Watauga",
  peak_start: "2026-10-12",
  peak_center: "2026-10-17",
  peak_end: "2026-10-22",
  components: {
    reference_date: "2026-10-06",
    reference_elevation_ft: 5000,
    elevation_shift_days: 10.84,
    thermal_shift_days: 0,
    temp_anomaly_f: null,
    half_window_days: 5,
  },
  thermal: { reason: "insufficient 2026 September data (0 days)" },
  basis: "elevation-climatology (photoperiod anchor + elevation lapse)",
  ...over,
});

describe("elevationBand", () => {
  it("splits on the bands the regional fall-color reports use", () => {
    expect(elevationBand(5436).label).toBe("Above 5,000 feet");
    expect(elevationBand(5000).label).toBe("Above 5,000 feet");
    expect(elevationBand(4999).label).toBe("3,500 to 5,000 feet");
    expect(elevationBand(3573).label).toBe("3,500 to 5,000 feet");
    expect(elevationBand(3499).label).toBe("2,500 to 3,500 feet");
    expect(elevationBand(2500).label).toBe("2,500 to 3,500 feet");
    expect(elevationBand(2471).label).toBe("Below 2,500 feet");
    expect(elevationBand(1001).label).toBe("Below 2,500 feet");
  });

  it("gives every band a blurb, since the copy renders it unconditionally", () => {
    for (const ft of [1001, 2677, 3701, 5436]) {
      expect(elevationBand(ft).blurb.length).toBeGreaterThan(0);
    }
  });
});

describe("fmtPeakWindow", () => {
  it("collapses a same-month range to one month name", () => {
    expect(fmtPeakWindow("2026-10-12", "2026-10-22")).toBe("October 12–22");
  });

  it("names both months when the window crosses one", () => {
    expect(fmtPeakWindow("2026-10-27", "2026-11-06")).toBe("October 27–November 6");
  });

  it("returns empty rather than a stray dash on unparseable input", () => {
    expect(fmtPeakWindow("", "2026-10-22")).toBe("");
    expect(fmtPeakWindow("2026-13-01", "2026-10-22")).toBe("");
    expect(fmtPeakWindow("Oct 12", "Oct 22")).toBe("");
  });
});

describe("hasThermalSignal", () => {
  it("is false before September data exists", () => {
    expect(hasThermalSignal(boone())).toBe(false);
  });

  it("is true once an anomaly actually moved the window", () => {
    const warm = boone({
      components: { ...boone().components, temp_anomaly_f: 2.4, thermal_shift_days: 3.6 },
    });
    expect(hasThermalSignal(warm)).toBe(true);
  });

  it("is false when an anomaly exists but rounded to no shift", () => {
    const flat = boone({
      components: { ...boone().components, temp_anomaly_f: 0, thermal_shift_days: 0 },
    });
    expect(hasThermalSignal(flat)).toBe(false);
  });
});

describe("lapseRatePerThousandFt", () => {
  it("recovers the model's 6.5 days per 1,000 ft from a low-elevation record", () => {
    expect(lapseRatePerThousandFt(boone())).toBe(6.5);
  });

  it("recovers the same rate above the reference, where the shift is negative", () => {
    const beech = boone({
      slug: "beech-mountain", name: "Beech Mountain", elevation_ft: 5436,
      components: { ...boone().components, elevation_shift_days: -2.83 },
    });
    expect(lapseRatePerThousandFt(beech)).toBe(6.5);
  });

  it("returns null at the reference elevation, where the rate is not recoverable", () => {
    const atRef = boone({
      elevation_ft: 5000,
      components: { ...boone().components, elevation_shift_days: 0 },
    });
    expect(lapseRatePerThousandFt(atRef)).toBeNull();
  });
});

describe("ridgeOffsetPhrase", () => {
  it("reads as days behind for a town below the reference", () => {
    expect(ridgeOffsetPhrase(boone())).toBe("about 11 days behind the 5,000 foot ridges");
  });

  it("reads as days ahead for a town above it", () => {
    const beech = boone({
      components: { ...boone().components, elevation_shift_days: -2.83 },
    });
    expect(ridgeOffsetPhrase(beech)).toBe("about 3 days ahead of the 5,000 foot ridges");
  });

  it("singularizes one day", () => {
    const one = boone({ components: { ...boone().components, elevation_shift_days: 1.1 } });
    expect(ridgeOffsetPhrase(one)).toBe("about 1 day behind the 5,000 foot ridges");
  });

  it("does not claim an offset at the reference", () => {
    const zero = boone({ components: { ...boone().components, elevation_shift_days: 0 } });
    expect(ridgeOffsetPhrase(zero)).toBe("right about with the 5,000 foot ridges");
  });
});

describe("leafWindowIsCurrent", () => {
  it("is true well before the window opens", () => {
    expect(leafWindowIsCurrent(boone(), new Date("2026-08-30T12:00:00-04:00"))).toBe(true);
  });

  it("is true inside the window", () => {
    expect(leafWindowIsCurrent(boone(), new Date("2026-10-17T12:00:00-04:00"))).toBe(true);
  });

  it("stays true through the grace period after the window closes", () => {
    expect(leafWindowIsCurrent(boone(), new Date("2026-11-20T12:00:00-05:00"))).toBe(true);
  });

  it("goes false once the window is stale, so last fall never ships as this fall", () => {
    expect(leafWindowIsCurrent(boone(), new Date("2026-12-31T12:00:00-05:00"))).toBe(false);
    expect(leafWindowIsCurrent(boone(), new Date("2027-09-01T12:00:00-04:00"))).toBe(false);
  });

  it("is false on an unparseable end date rather than rendering a bad window", () => {
    expect(leafWindowIsCurrent(boone({ peak_end: "" }), new Date("2026-08-30T12:00:00-04:00")))
      .toBe(false);
  });
});

// --- cross-town helpers (the /leaf hub) -------------------------------------

const at = (slug: string, ft: number, start: string, center: string, end: string): LeafPrediction => ({
  slug, name: slug, elevation_ft: ft,
  peak_start: start, peak_center: center, peak_end: end,
  components: {
    reference_date: "2026-10-06", reference_elevation_ft: 5000,
    elevation_shift_days: 0, thermal_shift_days: 0, temp_anomaly_f: null, half_window_days: 5,
  },
  basis: "elevation-climatology",
});

// Real 2026 bookends plus one mid-band town, so the span arithmetic is checkable
// against the shipped artifact.
const SET = [
  at("beech-mountain", 5436, "2026-09-28", "2026-10-03", "2026-10-08"),
  at("boone", 3333, "2026-10-12", "2026-10-17", "2026-10-22"),
  at("wilkesboro", 1024, "2026-10-27", "2026-11-01", "2026-11-06"),
];

describe("leafSeasonSpan", () => {
  it("spans the earliest start to the latest end, inclusive", () => {
    const span = leafSeasonSpan(SET);
    expect(span).toEqual({ start: "2026-09-28", end: "2026-11-06", days: 40 });
  });

  it("is null for an empty set rather than a zero-length season", () => {
    expect(leafSeasonSpan([])).toBeNull();
  });

  it("crosses the month boundary without dropping days", () => {
    const span = leafSeasonSpan([at("a", 3000, "2026-10-30", "2026-10-31", "2026-11-01")]);
    expect(span?.days).toBe(3);
  });
});

describe("leafBandRows", () => {
  it("groups towns into bands, highest ground first", () => {
    const rows = leafBandRows(SET);
    expect(rows.map((r) => r.label)).toEqual([
      "Above 5,000 feet", "2,500 to 3,500 feet", "Below 2,500 feet",
    ]);
  });

  it("omits bands with no tracked town instead of rendering an empty row", () => {
    // Nothing here sits between 3,500 and 5,000 ft.
    expect(leafBandRows(SET).some((r) => r.label === "3,500 to 5,000 feet")).toBe(false);
  });

  it("collapses each band to the span its towns actually cover", () => {
    const rows = leafBandRows([
      at("high-a", 5400, "2026-09-28", "2026-10-03", "2026-10-08"),
      at("high-b", 5100, "2026-10-01", "2026-10-06", "2026-10-11"),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].start).toBe("2026-09-28");
    expect(rows[0].end).toBe("2026-10-11");
    expect(rows[0].towns.map((t) => t.slug)).toEqual(["high-a", "high-b"]);
  });

  it("returns nothing for an empty set", () => {
    expect(leafBandRows([])).toEqual([]);
  });
});

describe("leafBarPosition", () => {
  const span = { start: "2026-09-28", end: "2026-11-06", days: 40 };

  it("puts the first window flush against the left edge", () => {
    const pos = leafBarPosition(span, "2026-09-28", "2026-10-08");
    expect(pos?.leftPct).toBe(0);
    expect(pos?.widthPct).toBeCloseTo((11 / 40) * 100, 5);
  });

  it("puts the last window flush against the right edge", () => {
    const pos = leafBarPosition(span, "2026-10-27", "2026-11-06")!;
    expect(pos.leftPct + pos.widthPct).toBeCloseTo(100, 5);
  });

  it("never lets a bar spill past the end of the track", () => {
    const pos = leafBarPosition(span, "2026-11-01", "2026-12-25")!;
    expect(pos.leftPct + pos.widthPct).toBeLessThanOrEqual(100);
  });

  it("is null for a degenerate span rather than dividing by zero", () => {
    expect(leafBarPosition({ start: "2026-10-06", end: "2026-10-06", days: 1 }, "2026-10-06", "2026-10-06")).toBeNull();
  });

  it("is null when a date will not parse", () => {
    expect(leafBarPosition(span, "not-a-date", "2026-10-08")).toBeNull();
  });
});

describe("leafBookends", () => {
  it("names the first town to turn and the last", () => {
    const ends = leafBookends(SET)!;
    expect(ends.first.slug).toBe("beech-mountain");
    expect(ends.last.slug).toBe("wilkesboro");
  });

  it("is null for an empty set", () => {
    expect(leafBookends([])).toBeNull();
  });
});

describe("leafByPeak", () => {
  it("orders by peak, highest ground breaking a tie", () => {
    const same = [
      at("low", 2500, "2026-10-12", "2026-10-17", "2026-10-22"),
      at("high", 3300, "2026-10-12", "2026-10-17", "2026-10-22"),
      at("early", 5400, "2026-09-28", "2026-10-03", "2026-10-08"),
    ];
    expect(leafByPeak(same).map((p) => p.slug)).toEqual(["early", "high", "low"]);
  });

  it("does not mutate its input", () => {
    const input = [...SET].reverse();
    const before = input.map((p) => p.slug);
    leafByPeak(input);
    expect(input.map((p) => p.slug)).toEqual(before);
  });
});
