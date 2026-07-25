import { describe, it, expect } from "vitest";
import { levelDisplay, conditionsAreFresh, type RoadConditions } from "@/lib/roads";

describe("levelDisplay", () => {
  it("maps each level to a label + tone", () => {
    expect(levelDisplay("Hazardous").tone).toBe("bad");
    expect(levelDisplay("Icy").tone).toBe("bad");
    expect(levelDisplay("Slushy").tone).toBe("warn");
    expect(levelDisplay("Wet").tone).toBe("warn");
    expect(levelDisplay("Clear").tone).toBe("good");
    expect(levelDisplay("Icy").label).toBe("Icy");
  });
});

const baseConditions = (over: Partial<RoadConditions>): RoadConditions => ({
  fetched_at: "2026-01-15T13:00:00-05:00",
  date: "2026-01-15",
  source: "test",
  fetch_ok: true,
  counties_tracked: ["ASHE", "AVERY", "WATAUGA"],
  incidents: [],
  road_conditions: [],
  parkway_alerts: [],
  worst_actual_level: "Clear",
  ...over,
});

describe("conditionsAreFresh", () => {
  const now = new Date("2026-01-15T18:00:00-05:00");
  it("is fresh when fetched recently and fetch_ok", () => {
    expect(conditionsAreFresh(baseConditions({}), now)).toBe(true);
  });
  it("gates off a failed fetch", () => {
    expect(conditionsAreFresh(baseConditions({ fetch_ok: false }), now)).toBe(false);
  });
  it("gates off a stale capture (older than 48h)", () => {
    expect(conditionsAreFresh(baseConditions({ fetched_at: "2026-01-10T13:00:00-05:00" }), now)).toBe(false);
  });
  it("gates off null / missing timestamp", () => {
    expect(conditionsAreFresh(null, now)).toBe(false);
  });
});
