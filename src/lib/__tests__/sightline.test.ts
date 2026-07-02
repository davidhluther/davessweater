import { describe, expect, it } from "vitest";
import {
  BURST_FINALE_M, BURST_TYPICAL_M, CLUTTER_PENALTY_M, MARGIN_NOISE_M,
  bestGroundNear, haversineM, losToBurst, spotMarginM, spotVerdict,
  terrariumElevationM, tileCoords, verdictFromMargins, type ElevFn, type LatLon,
} from "@/lib/sightline";

const A: LatLon = { lat: 36.2, lon: -81.7 };
const B: LatLon = { lat: 36.2, lon: -81.6 }; // ~9 km east

const flat = (elev: number): ElevFn => async () => elev;
/** Flat plain with a wall of `wallElev` in the middle 10% of the path. */
const walled = (base: number, wallElev: number): ElevFn => async (lat, lon) => {
  const t = (lon - A.lon) / (B.lon - A.lon);
  return t > 0.45 && t < 0.55 ? wallElev : base;
};

describe("terrarium decode", () => {
  it("(128,0,0) is sea level; 1000 m round-trips", () => {
    expect(terrariumElevationM(128, 0, 0)).toBe(0);
    expect(terrariumElevationM(131, 232, 0)).toBe(1000);
    expect(terrariumElevationM(0, 0, 0)).toBe(-32768);
  });
});

describe("tile math", () => {
  it("Boone lands in a sane z13 tile with in-range pixels", () => {
    const { tx, ty, px, py } = tileCoords(36.2168, -81.6746);
    expect(tx).toBe(Math.floor(((-81.6746 + 180) / 360) * 2 ** 13));
    expect(ty).toBeGreaterThan(0);
    expect(px).toBeGreaterThanOrEqual(0);
    expect(px).toBeLessThan(256);
    expect(py).toBeGreaterThanOrEqual(0);
    expect(py).toBeLessThan(256);
  });
});

describe("losToBurst", () => {
  it("flat terrain: burst clears by roughly its height", async () => {
    const r = await losToBurst(flat(1000), A, 1000, B, BURST_TYPICAL_M);
    // Sightline rises from eye height to burst apex; worst clearance is near
    // the observer, small but positive; earth bulge shaves a few meters.
    expect(r.marginM).toBeGreaterThan(0);
    expect(r.blockerKm).toBeNull();
    expect(r.distanceM).toBeGreaterThan(8000);
    expect(r.distanceM).toBeLessThan(10000);
  });

  it("a mid-path ridge above the sightline blocks, and reports the blocker", async () => {
    const r = await losToBurst(walled(1000, 1300), A, 1000, B, BURST_TYPICAL_M);
    expect(r.marginM).toBeLessThan(0);
    expect(r.blockerKm).toBeGreaterThan(3);
    expect(r.blockerKm).toBeLessThan(6);
    // Lifting the burst to the required height clears it.
    const lifted = await losToBurst(walled(1000, 1300), A, 1000, B, r.requiredAGLM + 1);
    expect(lifted.marginM).toBeGreaterThanOrEqual(0);
  });

  it("earth bulge matters at distance: same wall, longer path, worse margin", async () => {
    const FAR: LatLon = { lat: 36.2, lon: -81.5 }; // ~18 km
    const near = await losToBurst(flat(1000), A, 1000, B, BURST_TYPICAL_M);
    const far = await losToBurst(flat(1000), A, 1000, FAR, BURST_TYPICAL_M);
    expect(far.marginM).toBeLessThan(near.marginM);
  });

  it("haversine sanity: one degree of longitude at 36°N is ~90 km", () => {
    expect(haversineM(A, { lat: 36.2, lon: -80.7 })).toBeGreaterThan(85_000);
    expect(haversineM(A, { lat: 36.2, lon: -80.7 })).toBeLessThan(95_000);
  });
});

describe("bestGroundNear", () => {
  it("finds the high corner of the box", async () => {
    const bumpy: ElevFn = async (lat) => (lat > A.lat ? 1030 : 1000);
    expect(await bestGroundNear(bumpy, A)).toBe(1030);
  });
});

describe("verdict banding (published)", () => {
  it("clear needs +noise-band margin on typical shells", () => {
    expect(verdictFromMargins(MARGIN_NOISE_M, 100)).toBe("clear");
    expect(verdictFromMargins(MARGIN_NOISE_M - 1, 100)).toBe("marginal");
  });
  it("inside the noise band is marginal, either sign", () => {
    expect(verdictFromMargins(5, 60)).toBe("marginal");
    expect(verdictFromMargins(-14, 40)).toBe("marginal");
  });
  it("blocked at 90 but clearing at 150 is finale-only", () => {
    expect(verdictFromMargins(-40, 10)).toBe("finale-only");
  });
  it("blocked is blocked", () => {
    expect(verdictFromMargins(-200, -120)).toBe("blocked");
  });
  it("burst constants stay ordered", () => {
    expect(BURST_FINALE_M).toBeGreaterThan(BURST_TYPICAL_M);
  });
});

describe("spotVerdict — clutter allowance for known spots", () => {
  it("open spots use raw margins", () => {
    expect(spotVerdict({ margin90M: 20, margin150M: 60 }, "open")).toBe("clear");
  });
  it("built/wooded spots pay the clutter penalty", () => {
    // Jones House case: finale clears bare earth by ~12 m, but buildings eat it.
    expect(spotVerdict({ margin90M: -10, margin150M: 12 }, "built")).toBe("blocked");
    // Horn in the West case: finale clears by ~1 m in a wooded bowl.
    expect(spotVerdict({ margin90M: -24, margin150M: 1 }, "wooded")).toBe("blocked");
    // A genuinely high spot survives the penalty.
    expect(spotVerdict({ margin90M: 45, margin150M: 90 }, "wooded")).toBe("clear");
    // Thin-positive in woods degrades to marginal, not clear.
    expect(spotVerdict({ margin90M: 17, margin150M: 40 }, "wooded")).toBe("marginal");
  });
  it("spotMarginM reflects the same allowance", () => {
    expect(spotMarginM({ margin90M: 17 }, "wooded")).toBe(17 - CLUTTER_PENALTY_M);
    expect(spotMarginM({ margin90M: 17 }, "open")).toBe(17);
  });
});
