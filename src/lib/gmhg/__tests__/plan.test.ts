import { describe, it, expect } from "vitest";
import {
  availableLots, pickLot, isConcertOnly, buildDayPlan, shuttleCost,
} from "@/lib/gmhg/plan";
import { LOT_AVERY, LOT_LINVILLE, LOT_NEWLAND, LOT_SUGAR } from "@/lib/gmhg/constants";
import { GMHG_DAYS } from "@/lib/gmhg/schedule";
import { LOGISTICS, ev } from "./fixtures";

describe("availableLots", () => {
  it("encodes the lot-per-day rules", () => {
    expect(availableLots(GMHG_DAYS.thu, LOGISTICS, false)).toEqual([LOT_AVERY]);
    expect(availableLots(GMHG_DAYS.sun, LOGISTICS, false).sort()).toEqual([LOT_LINVILLE, LOT_SUGAR].sort());
    expect(availableLots(GMHG_DAYS.fri, LOGISTICS, false)).toHaveLength(4);
  });
  it("overrides to accessible transport when requested", () => {
    expect(availableLots(GMHG_DAYS.thu, LOGISTICS, true)).toEqual([LOT_AVERY]);
    expect(availableLots(GMHG_DAYS.fri, LOGISTICS, true)).toEqual([LOT_NEWLAND]);
    expect(availableLots(GMHG_DAYS.sun, LOGISTICS, true)).toEqual([LOT_NEWLAND]);
  });
});

describe("pickLot", () => {
  it("picks the nearest running lot to the origin and lists the rest", () => {
    const { lot, alternates } = pickLot(GMHG_DAYS.fri, "boone", LOGISTICS, false);
    expect(lot).toBe(LOT_LINVILLE); // 25 min from Boone, nearest of the four
    expect(alternates).not.toContain(LOT_LINVILLE);
    expect(alternates.length).toBe(3);
  });
});

describe("isConcertOnly", () => {
  it("is true only when every selection is a concert", () => {
    expect(isConcertOnly([ev(GMHG_DAYS.fri, "18:30", "center_field", { category: "concert" })])).toBe(true);
    expect(isConcertOnly([
      ev(GMHG_DAYS.fri, "18:30", "center_field", { category: "concert" }),
      ev(GMHG_DAYS.fri, "09:00", "field_left", { category: "athletics" }),
    ])).toBe(false);
    expect(isConcertOnly([])).toBe(false);
  });
});

describe("buildDayPlan", () => {
  it("computes a leave-by for a normal day (Boone → Linville, Fri AM rush)", () => {
    const p = buildDayPlan(
      { day: GMHG_DAYS.fri, origin: "boone", accessible: false, events: [ev(GMHG_DAYS.fri, "11:00", "center_field")] },
      LOGISTICS,
    );
    // 660 − drive 25 − heavyAM 40 − ride 20 − walk 15 = 560 (9:20 AM)
    expect(p.leaveByMin).toBe(560);
    expect(p.lot).toBe(LOT_LINVILLE);
    expect(p.needsShuttle).toBe(true);
  });

  it("switches to drive-up mode on a concert-only day", () => {
    const p = buildDayPlan(
      { day: GMHG_DAYS.fri, origin: "boone", accessible: false, events: [ev(GMHG_DAYS.fri, "18:30", "center_field", { category: "concert" })] },
      LOGISTICS,
    );
    expect(p.concertOnly).toBe(true);
    expect(p.needsShuttle).toBe(false);
    expect(p.leaveByMin).toBeNull();
    expect(p.lot).toBeNull();
  });
});

describe("shuttleCost", () => {
  it("charges $10 × party × distinct shuttle days, excluding concert-only days", () => {
    const plans = [
      buildDayPlan({ day: GMHG_DAYS.fri, origin: "boone", accessible: false, events: [ev(GMHG_DAYS.fri, "11:00", "center_field")] }, LOGISTICS),
      buildDayPlan({ day: GMHG_DAYS.sat, origin: "boone", accessible: false, events: [ev(GMHG_DAYS.sat, "11:00", "center_field")] }, LOGISTICS),
      buildDayPlan({ day: GMHG_DAYS.sun, origin: "boone", accessible: false, events: [ev(GMHG_DAYS.sun, "18:30", "center_field", { category: "concert" })] }, LOGISTICS),
    ];
    const c = shuttleCost(plans, 3);
    expect(c.shuttleDays).toBe(2); // Sun concert-only excluded
    expect(c.totalUsd).toBe(60);   // 10 × 3 × 2
  });
});
