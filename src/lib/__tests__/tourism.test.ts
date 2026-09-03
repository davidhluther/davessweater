import { describe, it, expect } from "vitest";
import {
  addDays,
  athleticsName,
  bandOf,
  comparablePool,
  crossConfirmation,
  dayClass,
  daysBetween,
  eventOverlay,
  heatBucket,
  heatCalendarDays,
  isoWeekday,
  leadDays,
  median,
  percentileRank,
  rateObservations,
  upcomingWeekend,
  vsTypical,
  weekdayLong,
  weekendRateSeries,
  type BusynessDay,
  type IndexObservation,
  type LodgingCapture,
  type RateObservation,
} from "@/lib/tourism";

// 2026-09-05 is a Saturday (App State's home opener, the night the real index
// scored 82 "slammed"). Every date fixture below hangs off that week.
const day = (date: string, score: number, over: Partial<BusynessDay> = {}): BusynessDay => ({
  date,
  score,
  band: bandOf(score),
  components: { hotel: 0, str: 0, events: 0, leaf: 0, weekend: 0 },
  drivers: [],
  events: [],
  ...over,
});

describe("date helpers", () => {
  it("reads the weekday without consulting the machine timezone", () => {
    expect(isoWeekday("2026-09-05")).toBe(6); // Saturday
    expect(isoWeekday("2026-09-04")).toBe(5); // Friday
    expect(isoWeekday("2026-09-06")).toBe(0); // Sunday
  });

  it("counts whole days across a month boundary", () => {
    expect(daysBetween("2026-08-30", "2026-09-02")).toBe(3);
    expect(daysBetween("2026-09-02", "2026-08-30")).toBe(-3);
    expect(leadDays("2026-09-02", "2026-09-05")).toBe(3);
  });

  it("names the weekday from the string, not from the machine's clock", () => {
    // The failure this guards: toLocaleDateString on a UTC-midnight Date renders
    // the PREVIOUS day in America/New_York, which is where this site runs.
    expect(weekdayLong("2026-09-05")).toBe("Saturday");
    expect(weekdayLong("2026-01-01")).toBe("Thursday");
  });

  it("adds days across a month boundary", () => {
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDays("2026-09-05", -1)).toBe("2026-09-04");
  });

  it("classes Friday and Saturday as the weekend, matching the engine's bonus", () => {
    expect(dayClass("2026-09-04")).toBe("weekend");
    expect(dayClass("2026-09-05")).toBe("weekend");
    expect(dayClass("2026-09-06")).toBe("weekday");
    expect(dayClass("2026-09-03")).toBe("weekday");
  });
});

describe("bandOf", () => {
  it("reproduces the engine's thresholds at every boundary", () => {
    expect(bandOf(0)).toBe("calm");
    expect(bandOf(34)).toBe("calm");
    expect(bandOf(35)).toBe("typical");
    expect(bandOf(54)).toBe("typical");
    expect(bandOf(55)).toBe("busy");
    expect(bandOf(74)).toBe("busy");
    expect(bandOf(75)).toBe("slammed");
    expect(bandOf(100)).toBe("slammed");
  });
});

describe("percentileRank", () => {
  it("splits ties rather than crediting a score with beating its equals", () => {
    expect(percentileRank([10, 20, 30, 40], 25)).toBe(50);
    // Sitting exactly on a value shared by half the pool: below=0, tie=2 of 4.
    expect(percentileRank([10, 10, 20, 20], 10)).toBe(25);
  });

  it("bounds at both ends", () => {
    expect(percentileRank([10, 20, 30], 5)).toBe(0);
    expect(percentileRank([10, 20, 30], 99)).toBe(100);
    expect(percentileRank([], 5)).toBe(0);
  });
});

describe("comparablePool", () => {
  const obs: IndexObservation[] = [
    // Same class (Saturday), same lead 3 — comparable.
    { issued: "2026-08-05", date: "2026-08-08", score: 40, band: "typical" },
    { issued: "2026-08-12", date: "2026-08-15", score: 50, band: "typical" },
    // Weekday — excluded on class.
    { issued: "2026-08-06", date: "2026-08-09", score: 12, band: "calm" },
    // Saturday but read 10 days out — excluded on lead.
    { issued: "2026-08-12", date: "2026-08-22", score: 90, band: "slammed" },
    // The target's own night at another lead — excluded as not a comparison.
    { issued: "2026-08-30", date: "2026-09-05", score: 70, band: "busy" },
  ];

  it("keeps only same-class nights read at a comparable lead", () => {
    expect(comparablePool(obs, { issued: "2026-09-02", date: "2026-09-05" })).toEqual([40, 50]);
  });

  it("never compares a night against itself", () => {
    const pool = comparablePool(obs, { issued: "2026-09-02", date: "2026-09-05" });
    expect(pool).not.toContain(70);
  });

  it("widens with the lead tolerance", () => {
    const wide = comparablePool(obs, { issued: "2026-09-02", date: "2026-09-05" }, { leadTolerance: 7 });
    expect(wide).toContain(90);
  });
});

describe("vsTypical", () => {
  // Twelve comparable Saturdays, all read three days out, scoring 30..41.
  const pool: IndexObservation[] = Array.from({ length: 12 }, (_, i) => {
    const stay = addDays("2026-06-06", i * 7);
    return { issued: addDays(stay, -3), date: stay, score: 30 + i, band: bandOf(30 + i) };
  });

  it("ranks a night against comparable nights and reports the sample", () => {
    const got = vsTypical(pool, { issued: "2026-09-02", date: "2026-09-05", score: 82 });
    expect(got).not.toBeNull();
    expect(got!.percentile).toBe(100);
    expect(got!.sampleSize).toBe(12);
    expect(got!.dayClass).toBe("weekend");
    expect(got!.leadDays).toBe(3);
    expect(got!.median).toBe(35.5);
    expect(got!.from).toBe("2026-06-06");
  });

  it("returns null rather than a number the record cannot support", () => {
    expect(vsTypical(pool.slice(0, 11), { issued: "2026-09-02", date: "2026-09-05", score: 82 })).toBeNull();
    expect(vsTypical([], { issued: "2026-09-02", date: "2026-09-05", score: 82 })).toBeNull();
  });

  it("places a middling night in the middle", () => {
    const got = vsTypical(pool, { issued: "2026-09-02", date: "2026-09-05", score: 35 });
    expect(got!.percentile).toBeGreaterThan(30);
    expect(got!.percentile).toBeLessThan(60);
  });

  it("honors a lowered minimum for callers that want one", () => {
    const got = vsTypical(pool.slice(0, 4), { issued: "2026-09-02", date: "2026-09-05", score: 82 }, {
      minComparable: 4,
    });
    expect(got!.sampleSize).toBe(4);
  });
});

describe("upcomingWeekend", () => {
  const horizon = [
    day("2026-09-02", 4),
    day("2026-09-03", 8),
    day("2026-09-04", 52),
    day("2026-09-05", 82),
    day("2026-09-06", 17),
    day("2026-09-11", 37),
    day("2026-09-12", 44),
  ];

  it("pairs the next Saturday with the Friday of the SAME weekend", () => {
    const got = upcomingWeekend(horizon, "2026-09-02");
    expect(got!.friday!.date).toBe("2026-09-04");
    expect(got!.saturday!.date).toBe("2026-09-05");
    expect(got!.peak.date).toBe("2026-09-05");
  });

  it("does not retire the current Saturday at breakfast", () => {
    const got = upcomingWeekend(horizon, "2026-09-05");
    expect(got!.saturday!.date).toBe("2026-09-05");
    // Friday is behind us, so it is absent rather than paired from next week.
    expect(got!.friday).toBeNull();
  });

  it("takes the busier of the two nights as the headline", () => {
    const fridayHeavy = [day("2026-09-04", 90), day("2026-09-05", 40)];
    expect(upcomingWeekend(fridayHeavy, "2026-09-01")!.peak.date).toBe("2026-09-04");
  });

  it("returns null when the horizon holds no weekend", () => {
    expect(upcomingWeekend([day("2026-09-07", 10), day("2026-09-08", 10)], "2026-09-07")).toBeNull();
  });
});

describe("crossConfirmation", () => {
  const withParts = (date: string, leaf: number, hotel: number, score = 70) =>
    day(date, score, { components: { hotel, str: 0, events: 0, leaf, weekend: 0 } });

  it("finds nights where the leaf model and the hotels agree independently", () => {
    // 12 of 15 leaf points = 80% of towns at peak; 36 of 40 hotel = 90% priced high.
    const got = crossConfirmation([withParts("2026-10-17", 12, 36)]);
    expect(got).toHaveLength(1);
    expect(got[0].leafShare).toBeCloseTo(0.8);
    expect(got[0].hotelShare).toBeCloseTo(0.9);
  });

  it("stays silent when only one of the two signals is up", () => {
    expect(crossConfirmation([withParts("2026-09-05", 0, 38)])).toEqual([]);
    expect(crossConfirmation([withParts("2026-10-20", 14, 4)])).toEqual([]);
  });

  it("stays silent out of leaf season, which is where September sits", () => {
    expect(crossConfirmation([withParts("2026-09-05", 0, 0)])).toEqual([]);
  });

  it("survives a day the engine wrote without a components block", () => {
    const bare = { ...day("2026-10-17", 70) } as unknown as import("@/lib/tourism").BusynessDay;
    delete (bare as { components?: unknown }).components;
    expect(crossConfirmation([bare])).toEqual([]);
  });
});

describe("heat calendar", () => {
  it("emits a contiguous run of days and keeps unread days null", () => {
    const days = heatCalendarDays({ "2026-09-04": 0.783, "2026-09-05": 0.957 }, "2026-09-03", 4);
    expect(days.map((d) => d.date)).toEqual([
      "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06",
    ]);
    expect(days[0].share).toBeNull();
    expect(days[1].share).toBe(0.783);
  });

  it("survives a capture with no bands at all", () => {
    expect(heatCalendarDays(undefined, "2026-09-03", 2).every((d) => d.share === null)).toBe(true);
  });

  it("buckets by share and keeps 'no reading' distinct from 'nobody is full'", () => {
    expect(heatBucket(null)).toBeNull();
    expect(heatBucket(0)).toBe(0);
    expect(heatBucket(0.043)).toBe(0);
    expect(heatBucket(0.3)).toBe(2);
    expect(heatBucket(0.652)).toBe(3);
    expect(heatBucket(0.957)).toBe(4);
  });
});

describe("weekend rate trend", () => {
  const capture = (stays: Record<string, number>): LodgingCapture => ({
    fetched_at: "x",
    source: "xotelo",
    summary: {
      towns: {
        boone: Object.fromEntries(
          Object.entries(stays).map(([d, r]) => [d, { median_min_rate: r, hotels_reporting: 12 }]),
        ),
      },
      high_share: {},
    },
  });

  it("flattens captures into priced nights carrying their lead time", () => {
    const obs = rateObservations(
      [{ captured: "2026-09-02", capture: capture({ "2026-09-05": 263.5 }) }],
      "boone",
    );
    expect(obs).toEqual([
      { stay: "2026-09-05", captured: "2026-09-02", lead: 3, median: 263.5, hotels: 12 },
    ]);
  });

  it("ignores a town the capture does not carry", () => {
    expect(
      rateObservations([{ captured: "2026-09-02", capture: capture({ "2026-09-05": 263.5 }) }], "vilas"),
    ).toEqual([]);
  });

  const obs: RateObservation[] = [
    // 08-29 read at leads 1..5 — the lead-3 reading is 172.
    { stay: "2026-08-29", captured: "2026-08-28", lead: 1, median: 161, hotels: 13 },
    { stay: "2026-08-29", captured: "2026-08-26", lead: 3, median: 172, hotels: 13 },
    { stay: "2026-08-29", captured: "2026-08-24", lead: 5, median: 161, hotels: 13 },
    // 09-05 read at lead 3.
    { stay: "2026-09-05", captured: "2026-09-02", lead: 3, median: 263.5, hotels: 12 },
    // 09-12 only ever read from ten days out — not comparable at lead 3.
    { stay: "2026-09-12", captured: "2026-09-02", lead: 10, median: 199, hotels: 13 },
    // A Friday — excluded, this series is Saturdays.
    { stay: "2026-09-04", captured: "2026-09-01", lead: 3, median: 242, hotels: 13 },
  ];

  it("takes each Saturday's reading at the matched lead, in date order", () => {
    const { points } = weekendRateSeries(obs);
    expect(points.map((p) => p.stay)).toEqual(["2026-08-29", "2026-09-05"]);
    expect(points[0].median).toBe(172);
    expect(points.every((p) => p.lead === 3)).toBe(true);
  });

  it("drops a weekend never read at a comparable lead, and says which", () => {
    expect(weekendRateSeries(obs).excluded).toEqual(["2026-09-12"]);
  });

  it("can be pointed at Fridays instead", () => {
    const { points } = weekendRateSeries(obs, { weekday: 5 });
    expect(points.map((p) => p.stay)).toEqual(["2026-09-04"]);
  });

  it("medians an even and an odd list", () => {
    expect(median([1, 2, 3])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe("eventOverlay", () => {
  const horizon = [
    day("2026-09-04", 52, { events: ["art-in-the-park-2026"] }),
    day("2026-09-05", 82, { events: ["asu-fb-2026", "vcal_9896-appstatesports.com"] }),
    day("2026-09-12", 44, { events: ["art-in-the-park-2026"] }),
  ];
  const registry = [
    { id: "asu-fb-2026", name: "App State home football 2026" },
    { id: "art-in-the-park-2026", name: "Art in the Park (monthly)" },
  ];

  it("names each event once and collects every date it lands on", () => {
    const got = eventOverlay(horizon, registry);
    const art = got.find((e) => e.id === "art-in-the-park-2026")!;
    expect(art.name).toBe("Art in the Park (monthly)");
    expect(art.dates).toEqual(["2026-09-04", "2026-09-12"]);
  });

  it("orders by first appearance", () => {
    expect(eventOverlay(horizon, registry)[0].id).toBe("art-in-the-park-2026");
  });

  it("falls back to the athletics feed's own name for a calendar uid", () => {
    const got = eventOverlay(horizon, registry, {
      "vcal_9896-appstatesports.com": "App State Football vs Maine",
    });
    expect(got.find((e) => e.id === "vcal_9896-appstatesports.com")!.name).toBe(
      "App State Football vs Maine",
    );
  });

  it("never silently drops a driver the score counted", () => {
    const got = eventOverlay([day("2026-09-05", 82, { events: ["mystery-id"] })], []);
    expect(got).toHaveLength(1);
    expect(got[0].name).toBe("mystery-id");
  });
});

describe("athleticsName", () => {
  it("shortens the calendar's summary line into something printable", () => {
    expect(athleticsName("Appalachian State University Football vs Maine - Gold Out")).toBe(
      "App State Football vs Maine",
    );
    expect(athleticsName("Appalachian State University Men's Basketball vs Western Carolina (exh.)")).toBe(
      "App State Men's Basketball vs Western Carolina (exh.)",
    );
  });
});
