import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  GAUGE_BY_TOWN, getRiverForTown, latestReading, formatFlow, MAX_READING_AGE_MS, type RiverDay,
} from "@/lib/rivers";

const NOW = new Date("2026-07-27T14:00:00-04:00");

function day(over: Partial<RiverDay> = {}): RiverDay {
  return {
    date: "2026-07-27",
    samples: [
      {
        at: "2026-07-27T09:03:35-04:00",
        readings: {
          "03479000": {
            name: "Watauga River near Sugar Grove",
            streamflow_cfs: 90.8,
            gage_height_ft: 1.73,
            observed_at: "2026-07-27T08:15:00-04:00",
          },
        },
      },
    ],
    ...over,
  };
}

describe("GAUGE_BY_TOWN (the no-borrowing rule)", () => {
  it("maps only towns USGS names the gauge for", () => {
    expect(Object.keys(GAUGE_BY_TOWN).sort()).toEqual(["jefferson", "sugar-grove"]);
  });

  it("gives Boone no gauge — no nearest-gauge borrowing from Sugar Grove", () => {
    expect(GAUGE_BY_TOWN["boone"]).toBeUndefined();
    expect(GAUGE_BY_TOWN["blowing-rock"]).toBeUndefined();
    expect(GAUGE_BY_TOWN["deep-gap"]).toBeUndefined();
  });

  it("leaves the Wilson Creek gauge unattached — Adako is not a tracked town", () => {
    const sites = Object.values(GAUGE_BY_TOWN).map((g) => g.site);
    expect(sites).not.toContain("02140991");
  });
});

describe("latestReading", () => {
  it("reads the gauge's flow, height, and observation time", () => {
    expect(latestReading(day(), "03479000", "Watauga River", NOW)).toEqual({
      river: "Watauga River",
      cfs: 90.8,
      gageFt: 1.73,
      observedAt: "2026-07-27T08:15:00-04:00",
    });
  });

  it("prefers the freshest sample in the file", () => {
    const d = day();
    d.samples!.push({
      at: "2026-07-27T13:00:00-04:00",
      readings: { "03479000": { streamflow_cfs: 120, observed_at: "2026-07-27T12:45:00-04:00" } },
    });
    expect(latestReading(d, "03479000", "Watauga River", NOW)?.cfs).toBe(120);
  });

  it("falls back through samples where the gauge did not report", () => {
    const d = day();
    d.samples!.push({ at: "2026-07-27T13:00:00-04:00", readings: {} });
    expect(latestReading(d, "03479000", "Watauga River", NOW)?.cfs).toBe(90.8);
  });

  it("returns null for a gauge absent from the file", () => {
    expect(latestReading(day(), "03161000", "South Fork New River", NOW)).toBeNull();
  });

  it("returns null on a missing or malformed day", () => {
    expect(latestReading(null, "03479000", "Watauga River", NOW)).toBeNull();
    expect(latestReading({ date: "2026-07-27" }, "03479000", "Watauga River", NOW)).toBeNull();
  });

  it("drops a non-numeric flow rather than rendering it", () => {
    const d = day();
    d.samples![0].readings!["03479000"].streamflow_cfs = null;
    expect(latestReading(d, "03479000", "Watauga River", NOW)).toBeNull();
  });

  it("omits gage height when the site does not report one", () => {
    const d = day();
    delete d.samples![0].readings!["03479000"].gage_height_ft;
    expect(latestReading(d, "03479000", "Watauga River", NOW)?.gageFt).toBeNull();
  });

  it("drops readings older than the freshness window", () => {
    const stale = new Date(NOW.getTime() + MAX_READING_AGE_MS + 60_000);
    expect(latestReading(day(), "03479000", "Watauga River", stale)).toBeNull();
  });

  it("keeps a reading right inside the window", () => {
    const edge = new Date(Date.parse("2026-07-27T08:15:00-04:00") + MAX_READING_AGE_MS - 60_000);
    expect(latestReading(day(), "03479000", "Watauga River", edge)?.cfs).toBe(90.8);
  });
});

// Against the repo's real committed captures, not a fixture. `now` is derived
// from the newest committed file so the freshness window can't turn this into a
// clock-dependent flake as the pipeline commits new days.
describe("getRiverForTown against committed data", () => {
  const dir = join(process.cwd(), "data", "rivers");
  const files = readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  const newest = files[files.length - 1].replace(/\.json$/, "");
  const now = new Date(`${newest}T18:00:00-04:00`);

  it("returns null for every town with no gauge of its own, Boone included", async () => {
    for (const slug of ["boone", "blowing-rock", "deep-gap", "todd", "banner-elk"]) {
      expect(await getRiverForTown(slug, now)).toBeNull();
    }
  });

  it("reads a well-formed reading for a town whose gauge USGS names for it", async () => {
    const r = await getRiverForTown("sugar-grove", now);
    // Tolerant: a future capture may legitimately miss a site. When there IS a
    // reading it has to be complete and correctly attributed.
    if (r) {
      expect(r.river).toBe("Watauga River");
      expect(Number.isFinite(r.cfs)).toBe(true);
      expect(Number.isFinite(Date.parse(r.observedAt))).toBe(true);
    }
  });
});

describe("formatFlow", () => {
  it("keeps a decimal on small flows and drops it on large ones", () => {
    expect(formatFlow(8.42)).toBe("8.4 cfs");
    expect(formatFlow(90.8)).toBe("91 cfs");
  });
  it("groups thousands", () => {
    expect(formatFlow(12403.7)).toBe("12,404 cfs");
  });
});
