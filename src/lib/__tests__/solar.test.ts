// BUILD GATE — this file runs inside `prebuild`, so a failure here fails the
// Vercel build. The page's entire premise is "we publish the exact time";
// suncalc returns UTC instants, and a timezone slip (12:46 AM dusk) would be
// brand-fatal. Bounds below are hardcoded UTC instants derived by hand
// (July 4 EDT = UTC-4, December EST = UTC-5) so the gate never trusts the
// library's own zone math to check itself.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  NY_TZ, fmtTime, lastDirectSun, localDateString, minutesBetween, moonPhaseName,
  solarPacket, tzOffsetMs, zonedTimeToUtcMs, type HorizonPoint,
} from "@/lib/solar";

const BOONE = { lat: 36.2168, lon: -81.6746 };

describe("BUILD GATE: Boone July 4, 2026 dusk window", () => {
  const p = solarPacket({ ...BOONE, date: "2026-07-04", tz: NY_TZ });

  it("sunset falls between 8:30 and 9:00 PM EDT (00:30–01:00 UTC July 5)", () => {
    expect(p.sunset).not.toBeNull();
    const t = p.sunset!.getTime();
    expect(t).toBeGreaterThanOrEqual(Date.UTC(2026, 6, 5, 0, 30));
    expect(t).toBeLessThanOrEqual(Date.UTC(2026, 6, 5, 1, 0));
  });

  it("renders as an 8:xx PM string via the page's actual formatting path", () => {
    expect(fmtTime(p.sunset, NY_TZ)).toMatch(/^8:(3|4|5)\d PM$/);
  });

  it("civil dusk ends 20–40 minutes after sunset, before 9:45 PM EDT", () => {
    const gap = minutesBetween(p.sunset, p.civilDuskEnd);
    expect(gap).toBeGreaterThanOrEqual(20);
    expect(gap).toBeLessThanOrEqual(40);
    expect(p.civilDuskEnd!.getTime()).toBeLessThanOrEqual(Date.UTC(2026, 6, 5, 1, 45));
  });

  it("nautical dusk ends after civil dusk, before 10:30 PM EDT", () => {
    expect(p.nauticalDuskEnd!.getTime()).toBeGreaterThan(p.civilDuskEnd!.getTime());
    expect(p.nauticalDuskEnd!.getTime()).toBeLessThanOrEqual(Date.UTC(2026, 6, 5, 2, 30));
  });

  it("still holds for the CURRENT year's July 4 (annual auto-compute never regresses)", () => {
    const year = Number(localDateString(NY_TZ).slice(0, 4));
    const now = solarPacket({ ...BOONE, date: `${year}-07-04`, tz: NY_TZ });
    expect(fmtTime(now.sunset, NY_TZ)).toMatch(/^8:(3|4|5)\d PM$/);
  });
});

describe("zone math is independent of the machine timezone", () => {
  it("8:30 PM on 2026-07-04 in New York is 00:30 UTC July 5 (EDT)", () => {
    expect(zonedTimeToUtcMs("2026-07-04", 20, 30, NY_TZ)).toBe(Date.UTC(2026, 6, 5, 0, 30));
  });
  it("noon on 2026-01-15 in New York is 17:00 UTC (EST)", () => {
    expect(zonedTimeToUtcMs("2026-01-15", 12, 0, NY_TZ)).toBe(Date.UTC(2026, 0, 15, 17, 0));
  });
  it("handles the 2026 spring-forward day (Mar 8) and fall-back day (Nov 1)", () => {
    expect(zonedTimeToUtcMs("2026-03-08", 12, 0, NY_TZ)).toBe(Date.UTC(2026, 2, 8, 16, 0));
    expect(zonedTimeToUtcMs("2026-11-01", 12, 0, NY_TZ)).toBe(Date.UTC(2026, 10, 1, 17, 0));
  });
  it("offset lookup returns -4h in July, -5h in January", () => {
    expect(tzOffsetMs(Date.UTC(2026, 6, 4, 12, 0), NY_TZ)).toBe(-4 * 3_600_000);
    expect(tzOffsetMs(Date.UTC(2026, 0, 15, 12, 0), NY_TZ)).toBe(-5 * 3_600_000);
  });
});

describe("winter + moon + edge sanity", () => {
  it("Boone Dec 21, 2026 sunset falls between 4:45 and 5:45 PM EST", () => {
    const p = solarPacket({ ...BOONE, date: "2026-12-21", tz: NY_TZ });
    const t = p.sunset!.getTime();
    expect(t).toBeGreaterThanOrEqual(Date.UTC(2026, 11, 21, 21, 45));
    expect(t).toBeLessThanOrEqual(Date.UTC(2026, 11, 21, 22, 45));
  });

  it("July 4, 2026 moonrise lands inside the local calendar day, late evening", () => {
    const p = solarPacket({ ...BOONE, date: "2026-07-04", tz: NY_TZ });
    expect(p.moonrise).not.toBeNull();
    const t = p.moonrise!.getTime();
    expect(t).toBeGreaterThanOrEqual(zonedTimeToUtcMs("2026-07-04", 0, 0, NY_TZ));
    expect(t).toBeLessThan(zonedTimeToUtcMs("2026-07-05", 0, 0, NY_TZ));
    // Waning gibbous that night — bright, but rises after the shows end.
    expect(p.moon.name).toBe("waning gibbous");
    expect(p.moon.fraction).toBeGreaterThan(0.5);
    expect(fmtTime(p.moonrise, NY_TZ)).toMatch(/PM$/);
  });

  it("polar latitudes return null instead of Invalid Date (future /sunset safety)", () => {
    const p = solarPacket({ lat: 78.22, lon: 15.65, date: "2026-07-04", tz: "Arctic/Longyearbyen" });
    expect(p.sunset).toBeNull(); // midnight sun
  });

  it("elevation applies a sea-level-horizon dip (later sunset) — why the page passes 0", () => {
    const flat = solarPacket({ ...BOONE, date: "2026-07-04", tz: NY_TZ });
    const high = solarPacket({ ...BOONE, elevationM: 975, date: "2026-07-04", tz: NY_TZ });
    expect(high.sunset!.getTime()).toBeGreaterThan(flat.sunset!.getTime());
  });

  it("CONVENTION GUARD: a flat horizon loses the sun within minutes of sunset", () => {
    // lastDirectSun leans on suncalc getPosition returning DEGREES with
    // azimuth from NORTH. If a dependency update flips the convention back to
    // radians-from-south, this equality breaks loudly.
    const flat: HorizonPoint[] = Array.from({ length: 91 }, (_, i) => ({ az: 235 + i, deg: -0.6 }));
    const t = lastDirectSun(flat, "2026-07-04", NY_TZ, BOONE.lat, BOONE.lon);
    const sunset = solarPacket({ ...BOONE, date: "2026-07-04", tz: NY_TZ }).sunset!;
    expect(t).not.toBeNull();
    expect(Math.abs(t!.getTime() - sunset.getTime())).toBeLessThan(12 * 60_000);
  });

  it("Clawson-Burnley loses direct sun 10–50 min before sunset (committed terrain)", () => {
    const terrain = JSON.parse(
      readFileSync(join(process.cwd(), "data", "terrain.json"), "utf8"),
    ) as { horizons: Record<string, HorizonPoint[]> };
    const t = lastDirectSun(terrain.horizons["boone"], "2026-07-04", NY_TZ, 36.2049, -81.6507);
    expect(t).not.toBeNull();
    expect(fmtTime(t, NY_TZ)).toMatch(/^8:/);
    const sunset = solarPacket({ lat: 36.2049, lon: -81.6507, date: "2026-07-04", tz: NY_TZ }).sunset!;
    const gap = minutesBetween(t, sunset)!;
    expect(gap).toBeGreaterThanOrEqual(10);
    expect(gap).toBeLessThanOrEqual(50);
  });

  it("moon phase names cover the wheel", () => {
    expect(moonPhaseName(0)).toBe("new moon");
    expect(moonPhaseName(0.5)).toBe("full moon");
    expect(moonPhaseName(0.657)).toBe("waning gibbous");
    expect(moonPhaseName(0.99)).toBe("new moon");
    expect(moonPhaseName(0.9)).toBe("waning crescent");
  });
});
