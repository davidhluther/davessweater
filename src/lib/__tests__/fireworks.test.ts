import { describe, expect, it } from "vitest";
import {
  compass16, downwindCompass, isStale, nightVerdict, pageMode,
  windVectorMean, windowStats, type FireworksHour,
} from "@/lib/fireworks";

function hour(overrides: Partial<FireworksHour> & { time: string }): FireworksHour {
  return {
    cloud_low: 10, cloud_mid: 10, cloud_high: 10,
    precip_prob: 5, precip_in: 0, temp_f: 70, dewpoint_f: 55,
    wind_mph: 5, wind_dir_deg: 240, visibility_m: 24_000,
    ...overrides,
  };
}

const T = (h: number) => `2026-07-04T${String(h).padStart(2, "0")}:00`;
const night = (o: Partial<FireworksHour> = {}) =>
  [20, 21, 22].map((h) => hour({ time: T(h), ...o }));

describe("windowStats", () => {
  it("uses only the 8–11 PM window", () => {
    const hours = [hour({ time: T(17), cloud_low: 100 }), ...night({ cloud_low: 20 })];
    const s = windowStats(hours)!;
    expect(s.hoursUsed).toBe(3);
    expect(s.cloudLowAvg).toBe(20);
  });
  it("returns null when the window is missing", () => {
    expect(windowStats([hour({ time: T(17) })])).toBeNull();
    expect(windowStats([])).toBeNull();
  });
  it("converts visibility to miles and takes the worst hour", () => {
    const s = windowStats(night({ visibility_m: 1609.344 }))!;
    expect(s.visibilityMinMi).toBeCloseTo(1, 5);
  });
  it("takes the tightest temp/dew-point spread", () => {
    const hours = [
      hour({ time: T(20), temp_f: 70, dewpoint_f: 55 }),
      hour({ time: T(21), temp_f: 66, dewpoint_f: 64 }),
      hour({ time: T(22), temp_f: 68, dewpoint_f: 60 }),
    ];
    expect(windowStats(hours)!.spreadMinF).toBe(2);
  });
});

describe("nightVerdict — the published rubric", () => {
  it("clear night is clear", () => {
    expect(nightVerdict(windowStats(night())).verdict).toBe("clear");
  });
  it("a low deck over 60% is Likely Obstructed", () => {
    const v = nightVerdict(windowStats(night({ cloud_low: 75 })));
    expect(v.verdict).toBe("obstructed");
    expect(v.reasons[0]).toMatch(/low cloud/i);
  });
  it("fog visibility under 2 mi is Likely Obstructed even with clear skies", () => {
    const v = nightVerdict(windowStats(night({ cloud_low: 0, visibility_m: 1200 })));
    expect(v.verdict).toBe("obstructed");
    expect(v.reasons[0]).toMatch(/visibility/i);
  });
  it("likely + material rain is Likely Obstructed; likely + trace is not", () => {
    expect(nightVerdict(windowStats(night({ precip_prob: 80, precip_in: 0.05 }))).verdict).toBe("obstructed");
    expect(nightVerdict(windowStats(night({ precip_prob: 80, precip_in: 0 }))).verdict).toBe("iffy");
  });
  it("valley-fog setup (spread < 3°F) is Iffy", () => {
    const v = nightVerdict(windowStats(night({ temp_f: 64, dewpoint_f: 62 })));
    expect(v.verdict).toBe("iffy");
    expect(v.reasons[0]).toMatch(/valley-fog/i);
  });
  it("mid deck over 70% is Iffy", () => {
    expect(nightVerdict(windowStats(night({ cloud_mid: 85 }))).verdict).toBe("iffy");
  });
  it("no low-cloud signal → unavailable (we don't guess)", () => {
    expect(nightVerdict(windowStats(night({ cloud_low: null }))).verdict).toBe("unavailable");
    expect(nightVerdict(null).verdict).toBe("unavailable");
  });
});

describe("staleness fails closed", () => {
  const now = new Date("2026-07-04T12:00:00-04:00");
  it("fresh this morning: fine", () => {
    expect(isStale("2026-07-04T10:04:11-04:00", now)).toBe(false);
  });
  it("older than 36h: stale", () => {
    expect(isStale("2026-07-02T10:04:11-04:00", now)).toBe(true);
  });
  it("garbage timestamp: stale", () => {
    expect(isStale("not-a-date", now)).toBe(true);
  });
});

describe("wind", () => {
  it("circular mean crosses north correctly", () => {
    const { dirDeg } = windVectorMean([
      { wind_mph: 5, wind_dir_deg: 350 },
      { wind_mph: 5, wind_dir_deg: 10 },
    ]);
    expect(Math.min(dirDeg!, 360 - dirDeg!)).toBeLessThan(0.01);
  });
  it("compass + downwind", () => {
    expect(compass16(225)).toBe("SW");
    expect(compass16(0)).toBe("N");
    expect(downwindCompass(225)).toBe("NE");
  });
  it("no wind data → null direction", () => {
    expect(windVectorMean([{ wind_mph: null, wind_dir_deg: null }]).dirDeg).toBeNull();
  });
});

describe("pageMode — all three states exist from day one", () => {
  it("preview before July 3", () => expect(pageMode("2026-07-02")).toBe("preview"));
  it("tonight on July 3 and 4", () => {
    expect(pageMode("2026-07-03")).toBe("tonight");
    expect(pageMode("2026-07-04")).toBe("tonight");
  });
  it("archive from July 5 on", () => {
    expect(pageMode("2026-07-05")).toBe("archive");
    expect(pageMode("2026-09-01")).toBe("archive");
  });
});
