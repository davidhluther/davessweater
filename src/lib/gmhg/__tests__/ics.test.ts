import { describe, it, expect } from "vitest";
import { buildIcs, googleCalendarUrl } from "@/lib/gmhg/ics";
import { buildDayPlan, type DayPlan } from "@/lib/gmhg/plan";
import { GMHG_DAYS } from "@/lib/gmhg/schedule";
import { LOGISTICS, ev } from "./fixtures";

const FIXED_NOW = new Date("2026-07-06T12:00:00Z");

function plansFor(events: ReturnType<typeof ev>[]): Record<string, DayPlan> {
  const byDay: Record<string, ReturnType<typeof ev>[]> = {};
  for (const e of events) (byDay[e.day] ??= []).push(e);
  const out: Record<string, DayPlan> = {};
  for (const [day, evs] of Object.entries(byDay)) {
    out[day] = buildDayPlan({ day, origin: "boone", accessible: false, events: evs }, LOGISTICS);
  }
  return out;
}

describe("buildIcs", () => {
  const opening = ev(GMHG_DAYS.fri, "11:00", "center_field", { title: "Opening Ceremony", venue: "Main Field", highlight: true });
  const caber = ev(GMHG_DAYS.sat, "13:15", "center_field", { title: "Professional Caber Toss", venue: "Main Field - Center" });
  const ics = buildIcs([opening, caber], { now: FIXED_NOW, planByDay: plansFor([opening, caber]) });

  it("ships a valid calendar envelope with an explicit America/New_York VTIMEZONE", () => {
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("BEGIN:VTIMEZONE");
    expect(ics).toContain("TZID:America/New_York");
    expect(ics).toContain("TZOFFSETTO:-0400"); // EDT in July
    expect(ics).toContain("TZNAME:EDT");
  });

  it("references the zone by TZID on every DTSTART (no naive/floating times)", () => {
    expect(ics).toContain("DTSTART;TZID=America/New_York:20260710T110000");
    expect(ics).toContain("DTEND;TZID=America/New_York:20260710T120000"); // 60-min default
    expect(ics).toContain("DTSTART;TZID=America/New_York:20260711T131500");
  });

  it("uses CRLF line endings and balances BEGIN/END blocks", () => {
    expect(ics).toContain("\r\n");
    const begins = (ics.match(/\r\nBEGIN:/g) ?? []).length + (ics.startsWith("BEGIN:") ? 1 : 0);
    const ends = (ics.match(/\r\nEND:/g) ?? []).length;
    expect(begins).toBe(ends);
  });

  it("emits one VEVENT per selected event", () => {
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(2);
  });

  it("attaches a night-before CASH alarm and a morning leave-by alarm", () => {
    expect((ics.match(/BEGIN:VALARM/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(ics).toContain("CASH ONLY");
    expect(ics).toMatch(/TRIGGER;VALUE=DATE-TIME:20260709T220000Z/); // 6 PM EDT the day before Fri
    expect(ics).toContain("Time to leave for the Games");
  });

  it("marks estimated end times honestly in the description", () => {
    expect(ics).toContain("End time estimated");
  });
});

describe("googleCalendarUrl", () => {
  it("builds a prefilled template URL with the zone and local times", () => {
    const url = googleCalendarUrl(ev(GMHG_DAYS.fri, "11:00", "center_field", { title: "Opening Ceremony", venue: "Main Field" }));
    expect(url).toContain("https://calendar.google.com/calendar/render");
    expect(url).toContain("action=TEMPLATE");
    expect(url).toContain("dates=20260710T110000%2F20260710T120000");
    expect(url).toContain("ctz=America%2FNew_York");
  });
});
