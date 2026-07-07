import { describe, it, expect } from "vitest";
import { clusterFor, coVisible, effectiveZone, inFieldArea, inPeakWindow, walkMinutes, transitionVerdict } from "@/lib/gmhg/walk";
import { GMHG_DAYS, eventId } from "@/lib/gmhg/schedule";
import { ZONES, WALK, ev } from "./fixtures";

describe("clusterFor", () => {
  it("resolves zone → cluster from the dataset", () => {
    expect(clusterFor("center_field", ZONES)).toBe("center");
    expect(clusterFor("gaelic", ZONES)).toBe("south");
    expect(clusterFor("dance", ZONES)).toBe("north");
    expect(clusterFor("offsite", ZONES)).toBe("offsite");
    expect(clusterFor(null, ZONES)).toBeNull();
  });
});

describe("inPeakWindow", () => {
  it("flags the ceremony window any day and the post-caber crush on Saturday only", () => {
    expect(inPeakWindow(11 * 60 + 15, GMHG_DAYS.fri)).toBe(true); // opening ceremony
    expect(inPeakWindow(13 * 60 + 30, GMHG_DAYS.sat)).toBe(true); // post-caber Sat
    expect(inPeakWindow(13 * 60 + 30, GMHG_DAYS.fri)).toBe(false); // not Sat
    expect(inPeakWindow(18 * 60, GMHG_DAYS.sat)).toBe(true); // concert ingress
    expect(inPeakWindow(15 * 60, GMHG_DAYS.sat)).toBe(false);
  });
});

describe("walkMinutes", () => {
  it("uses the flat hop for the same zone", () => {
    expect(walkMinutes("center_field", "center_field", 10 * 60, GMHG_DAYS.sat, WALK, ZONES)).toBe(WALK.same_zone);
  });
  it("uses the cluster matrix off-peak (center↔south = 11)", () => {
    expect(walkMinutes("center_field", "gaelic", 10 * 60, GMHG_DAYS.sat, WALK, ZONES)).toBe(11);
  });
  it("applies the 1.5× crowd tax inside a peak window", () => {
    // 11 × 1.5 = 16.5 → 17 (post-caber Saturday peak)
    expect(walkMinutes("center_field", "gaelic", 13 * 60 + 30, GMHG_DAYS.sat, WALK, ZONES)).toBe(17);
  });
  it("treats the dance/review-stand ↔ field as a short field-area hop", () => {
    expect(walkMinutes("dance", "center_field", 10 * 60, GMHG_DAYS.fri, WALK, ZONES)).toBe(5);
    expect(walkMinutes("review_stand", "field_left", 10 * 60, GMHG_DAYS.fri, WALK, ZONES)).toBe(5);
  });
  it("returns null when a leg touches an off-field zone", () => {
    expect(walkMinutes("offsite", "center_field", 12 * 60, GMHG_DAYS.thu, WALK, ZONES)).toBeNull();
    expect(walkMinutes("center_field", null, 12 * 60, GMHG_DAYS.thu, WALK, ZONES)).toBeNull();
  });
});

describe("field-area co-visibility", () => {
  it("knows which zones are the field/bleachers area", () => {
    expect(inFieldArea("dance", ZONES)).toBe(true);
    expect(inFieldArea("review_stand", ZONES)).toBe(true);
    expect(inFieldArea("center_field", ZONES)).toBe(true);
    expect(inFieldArea("gaelic", ZONES)).toBe(false);
  });
  it("co-visible when both are in the field area or the same spot", () => {
    expect(coVisible("dance", "center_field", ZONES)).toBe(true);
    expect(coVisible("gaelic", "gaelic", ZONES)).toBe(true);
    expect(coVisible("gaelic", "harp_fiddle", ZONES)).toBe(false);
  });
});

describe("grove venues split apart", () => {
  const verdict = (a: ReturnType<typeof ev>, b: ReturnType<typeof ev>) =>
    transitionVerdict(a, b, WALK, ZONES, { from: eventId(a), to: eventId(b) });

  it("resolves each grove/stage to its own effective zone", () => {
    expect(effectiveZone({ zone: "music_groves", venue: "Grove I" })).toBe("grove1");
    expect(effectiveZone({ zone: "music_groves", venue: "Grove II" })).toBe("grove2");
    expect(effectiveZone({ zone: "music_groves", venue: "Alex Beaton Stage" })).toBe("alexbeaton");
    expect(effectiveZone({ zone: "gaelic", venue: "Gaelic Tent" })).toBe("gaelic");
  });

  it("does NOT call two different groves co-visible (they sit far apart)", () => {
    const a = ev(GMHG_DAYS.fri, "10:00", "music_groves", { venue: "Grove I" });
    const b = ev(GMHG_DAYS.fri, "10:00", "music_groves", { venue: "Grove II" });
    expect(verdict(a, b).status).toBe("overlap");
  });

  it("keeps two acts in the same grove co-visible", () => {
    const a = ev(GMHG_DAYS.fri, "10:00", "music_groves", { venue: "Grove I" });
    const b = ev(GMHG_DAYS.fri, "10:00", "music_groves", { venue: "Grove I" });
    expect(verdict(a, b).status).toBe("covisible");
  });
});

describe("transitionVerdict", () => {
  const verdict = (a: ReturnType<typeof ev>, b: ReturnType<typeof ev>) =>
    transitionVerdict(a, b, WALK, ZONES, { from: eventId(a), to: eventId(b) });

  it("won't-fit on the dataset's worked example (caber 13:15 → Gaelic 13:30)", () => {
    const caber = ev(GMHG_DAYS.sat, "13:15", "center_field", { title: "Professional Caber Toss" });
    const gaelic = ev(GMHG_DAYS.sat, "13:30", "gaelic", { title: "Gaelic event" });
    const t = verdict(caber, gaelic);
    expect(t.walkMin).toBe(17); // 11 base × 1.5 post-caber peak
    expect(t.gapMin).toBe(15);
    expect(t.status).toBe("wontfit");
  });

  it("flags a same-start pair in different areas as an overlap", () => {
    const a = ev(GMHG_DAYS.fri, "11:00", "gaelic");
    const b = ev(GMHG_DAYS.fri, "11:00", "harp_fiddle");
    expect(verdict(a, b).status).toBe("overlap");
  });

  it("calls a same-start field/bleachers pair co-visible, not a conflict", () => {
    // dance stage while athletics run on the field — you can watch both
    const dance = ev(GMHG_DAYS.fri, "11:00", "dance");
    const field = ev(GMHG_DAYS.fri, "11:00", "center_field");
    expect(verdict(dance, field).status).toBe("covisible");
  });

  it("passes a comfortable gap", () => {
    const a = ev(GMHG_DAYS.fri, "10:00", "center_field");
    const b = ev(GMHG_DAYS.fri, "11:00", "gaelic"); // 60 min gap, 14 min walk
    expect(verdict(a, b).status).toBe("ok");
  });

  it("marks a barely-enough gap as tight", () => {
    const a = ev(GMHG_DAYS.fri, "10:00", "center_field");
    const b = ev(GMHG_DAYS.fri, "10:15", "gaelic"); // 15 min gap, 11 min walk → 4 slack
    expect(verdict(a, b).status).toBe("tight");
  });

  it("reports offsite legs as unjudged", () => {
    const a = ev(GMHG_DAYS.thu, "14:00", "offsite");
    const b = ev(GMHG_DAYS.thu, "17:00", "center_field");
    expect(verdict(a, b).status).toBe("offsite");
  });
});
