import { describe, it, expect } from "vitest";
import { parseDocument } from "htmlparser2";
import type { Element, ChildNode } from "domhandler";
import {
  parseDays,
  parseDetail,
  sweaterShort,
  precipChanceLabel,
  moonSummary,
  forecastLine,
  toApiDay,
  buildRss,
  rssEscape,
  type RssItem,
} from "@/lib/publicFeed";
import type { StripDay } from "@/lib/forecast5";

// A StripDay factory with sane defaults so each test overrides only what it cares about.
function stripDay(over: Partial<StripDay> = {}): StripDay {
  return {
    date: "2026-07-25",
    weekday: "Fri",
    dayLabel: "Jul 25",
    high: 74,
    low: 55,
    precip: "rain",
    precipLabel: "Rain likely",
    precipProb: 40,
    summary: "Rain likely, warm",
    confidence: "high",
    sweaters: 2,
    count: 8,
    ...over,
  };
}

describe("parseDays", () => {
  it("defaults to 3 when absent", () => {
    expect(parseDays(null)).toEqual({ ok: true, value: 3 });
    expect(parseDays("")).toEqual({ ok: true, value: 3 });
  });
  it("accepts 1, 3, 5", () => {
    expect(parseDays("1")).toEqual({ ok: true, value: 1 });
    expect(parseDays("5")).toEqual({ ok: true, value: 5 });
  });
  it("rejects other numbers and junk with a helpful error", () => {
    expect(parseDays("2").ok).toBe(false);
    expect(parseDays("7").ok).toBe(false);
    const r = parseDays("abc");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/1, 3, 5/);
  });
});

describe("parseDetail", () => {
  it("defaults to summary", () => {
    expect(parseDetail(null)).toEqual({ ok: true, value: "summary" });
  });
  it("accepts full and rejects unknown", () => {
    expect(parseDetail("full")).toEqual({ ok: true, value: "full" });
    expect(parseDetail("verbose").ok).toBe(false);
  });
});

describe("sweaterShort", () => {
  it("maps the 0-5 count to a short label", () => {
    expect(sweaterShort(0)).toBe("No sweater");
    expect(sweaterShort(1)).toBe("No sweater");
    expect(sweaterShort(2)).toBe("Maybe a sweater");
    expect(sweaterShort(3)).toBe("Sweater weather");
    expect(sweaterShort(5)).toBe("Serious sweater weather");
  });
});

// The embeddable widget's two formatters. The widget carries NO sweater copy
// (owner, 2026-07-28), so these are the labels that replaced it.
describe("precipChanceLabel", () => {
  it("states the chance and the precip word when a source publishes one", () => {
    expect(precipChanceLabel(stripDay({ precip: "rain", precipProb: 59 }))).toBe("59% chance of rain");
    expect(precipChanceLabel(stripDay({ precip: "snow", precipProb: 70 }))).toBe("70% chance of snow");
    expect(precipChanceLabel(stripDay({ precip: "mixed", precipProb: 30 }))).toBe("30% chance of wintry mix");
  });
  it("says nothing on a wet day no source quantified, rather than contradict the summary", () => {
    // forecast5.summarize() needs a probability before it calls a day wet, so
    // this day's summary reads "Dry, warm" — "Rain likely" beside it would be
    // two contradicting claims on one card.
    expect(
      precipChanceLabel(stripDay({ precip: "rain", precipProb: undefined, precipLabel: "Rain likely", summary: "Dry, warm" })),
    ).toBeNull();
    expect(precipChanceLabel(stripDay({ precip: "snow", precipProb: undefined }))).toBeNull();
  });
  it("reads the dry label on a dry day, chance or not", () => {
    expect(precipChanceLabel(stripDay({ precip: "none", precipLabel: "No precip", precipProb: undefined })))
      .toBe("No precip");
    expect(precipChanceLabel(stripDay({ precip: "none", precipLabel: "No precip", precipProb: 4 })))
      .toBe("No precip");
  });
  it("never emits an undefined percentage", () => {
    for (const p of ["rain", "snow", "mixed", "none"]) {
      const out = precipChanceLabel(stripDay({ precip: p, precipProb: undefined }));
      if (out !== null) expect(out).not.toMatch(/undefined|NaN/);
    }
  });
});

describe("moonSummary", () => {
  it("capitalizes the phase and states how much is lit", () => {
    expect(moonSummary("waning gibbous", 0.617)).toBe("Waning gibbous, 62% lit");
    expect(moonSummary("first quarter", 0.5)).toBe("First quarter, 50% lit");
  });
  it("omits the percentage where the name already states it", () => {
    expect(moonSummary("new moon", 0.004)).toBe("New moon");
    expect(moonSummary("full moon", 0.998)).toBe("Full moon");
  });
  it("never lets an in-between phase round to a self-contradicting 100% or 0%", () => {
    expect(moonSummary("waxing gibbous", 0.9963)).toBe("Waxing gibbous, 99% lit");
    expect(moonSummary("waning crescent", 0.0021)).toBe("Waning crescent, 1% lit");
  });
});

describe("forecastLine", () => {
  it("formats the compact brand line with a precip chance", () => {
    expect(forecastLine(stripDay())).toBe("High 74 | Low 55 | 40% rain | 2 sweaters");
  });
  it("reads 'No precip' on a dry day and pluralizes sweaters", () => {
    expect(forecastLine(stripDay({ precip: "none", precipProb: undefined, sweaters: 1 }))).toBe(
      "High 74 | Low 55 | No precip | 1 sweater",
    );
  });
  it("names snow and falls back to the label without a probability", () => {
    expect(forecastLine(stripDay({ precip: "snow", precipProb: 70, sweaters: 5 }))).toBe(
      "High 74 | Low 55 | 70% snow | 5 sweaters",
    );
    expect(forecastLine(stripDay({ precip: "rain", precipProb: undefined, precipLabel: "Rain likely" }))).toBe(
      "High 74 | Low 55 | Rain likely | 2 sweaters",
    );
  });
  it("keeps a dry day's chance instead of stopping at 'No precip'", () => {
    expect(forecastLine(stripDay({ precip: "none", precipProb: 8, sweaters: 1 }))).toBe(
      "High 74 | Low 55 | No precip | 8% chance | 1 sweater",
    );
  });
  it("drops a flat 0% — it says the same thing as 'No precip' twice", () => {
    expect(forecastLine(stripDay({ precip: "none", precipProb: 0, sweaters: 1 }))).toBe(
      "High 74 | Low 55 | No precip | 1 sweater",
    );
  });
});

describe("toApiDay", () => {
  it("shapes a summary day with the brand long date and null chance handling", () => {
    const d = toApiDay(stripDay({ precip: "none", precipProb: undefined }));
    expect(d).toMatchObject({
      date: "2026-07-25",
      date_label: "July 25, 2026",
      high_f: 74,
      low_f: 55,
      precip_type: "none",
      precip_chance: null,
      precip_chance_sources: null,
      sweaters: 2,
      sweater_summary: "Maybe a sweater",
      dsi_sources: 8,
    });
    expect(d.summary).toContain("High 74");
  });

  it("carries how many forecasters published a chance alongside the chance", () => {
    const d = toApiDay(stripDay({ precipProb: 45, precipProbCount: 6 }));
    expect(d.precip_chance).toBe(45);
    expect(d.precip_chance_sources).toBe(6);
  });
});

describe("rssEscape", () => {
  it("escapes the five XML entities", () => {
    expect(rssEscape(`Ray's & "friends" <b> 5>3`)).toBe("Ray&apos;s &amp; &quot;friends&quot; &lt;b&gt; 5&gt;3");
  });
});

// ── RSS validity via a real XML parse ──────────────────────────────────────
function elements(node: ChildNode | ChildNode[], name: string): Element[] {
  const nodes = Array.isArray(node) ? node : [node];
  const out: Element[] = [];
  for (const n of nodes) {
    if (n.type === "tag" || n.type === "script" || n.type === "style") {
      const el = n as Element;
      if (el.name === name) out.push(el);
      out.push(...elements(el.children as ChildNode[], name));
    }
  }
  return out;
}
function text(el: Element): string {
  return (el.children as ChildNode[])
    .map((c) => ("data" in c ? (c as unknown as { data: string }).data : ""))
    .join("");
}

describe("buildRss", () => {
  const items: RssItem[] = [
    {
      title: "Friday, July 25, 2026: High 74 | Low 55 | 40% rain | 2 sweaters",
      link: "https://davessweater.com/",
      guid: "boone-forecast-2026-07-25",
      pubDate: new Date("2026-07-25T12:00:00Z"),
      description: "Boone forecast — dry & mild <check the math>",
    },
    {
      title: "Saturday, July 26, 2026: High 77 | Low 64 | 3 sweaters",
      link: "https://davessweater.com/",
      guid: "boone-forecast-2026-07-26",
      description: "Second day",
    },
  ];
  const xml = buildRss({
    title: "Dave's Sweater | Boone 3-day forecast",
    link: "https://davessweater.com/",
    description: "The Dave's Sweater Index consensus for Boone, NC.",
    selfUrl: "https://davessweater.com/feed/boone/forecast-3day.xml",
    items,
  });

  it("declares an XML prolog and rss 2.0 root", () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<rss version="2.0"');
  });

  it("parses as well-formed XML with the expected channel + items", () => {
    const doc = parseDocument(xml, { xmlMode: true });
    const rss = elements(doc.children as ChildNode[], "rss");
    expect(rss).toHaveLength(1);
    const channels = elements(doc.children as ChildNode[], "channel");
    expect(channels).toHaveLength(1);
    const chTitle = elements(channels[0].children as ChildNode[], "title")[0];
    expect(text(chTitle)).toBe("Dave's Sweater | Boone 3-day forecast");

    const itemEls = elements(channels[0].children as ChildNode[], "item");
    expect(itemEls).toHaveLength(2);
    for (const it of itemEls) {
      expect(elements(it.children as ChildNode[], "title")).toHaveLength(1);
      expect(elements(it.children as ChildNode[], "description")).toHaveLength(1);
      expect(elements(it.children as ChildNode[], "guid")).toHaveLength(1);
    }
  });

  it("round-trips escaped entities back to their literal text", () => {
    const doc = parseDocument(xml, { xmlMode: true });
    const descs = elements(doc.children as ChildNode[], "description");
    // The first item's description contained & and < > — the parser must decode them.
    expect(text(descs[1])).toBe("Boone forecast — dry & mild <check the math>");
  });
});
