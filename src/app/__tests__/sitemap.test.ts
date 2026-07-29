import { describe, it, expect } from "vitest";
import sitemap from "@/app/sitemap";
import { allTowns, latestComparisonDate } from "@/lib/towns";
import { getRoadsForecast } from "@/lib/roads";
import { REPORTS, TOOLS } from "@/content/resources";

// The sitemap runs against the committed data/ tree, the same way it does at
// build time, so these assertions describe the file Google actually fetches.
const BASE = "https://davessweater.com";

const entries = await sitemap();
const byUrl = new Map(entries.map((e) => [String(e.url), e]));
const at = (url: string) => {
  const e = byUrl.get(url);
  if (!e) throw new Error(`sitemap is missing ${url}`);
  return e;
};
// MetadataRoute.Sitemap types lastModified as string | Date; ours are Dates.
const isoDay = (url: string): string | undefined => {
  const v = at(url).lastModified;
  return v === undefined ? undefined : new Date(v).toISOString().slice(0, 10);
};

describe("sitemap lastModified", () => {
  it("stamps each town's pages with that town's own latest comparison date", async () => {
    const towns = await allTowns();
    const others = towns.filter((t) => t.slug !== "boone");
    expect(others.length).toBeGreaterThan(0);
    for (const t of others) {
      const expected = await latestComparisonDate(t.slug);
      expect(expected, `${t.slug} has no comparisons`).toBeTruthy();
      // The forecast page and the accuracy board both render that town's data,
      // so both move on the same day — the day the data moved, not build day.
      expect(isoDay(`${BASE}/weather/${t.slug}`)).toBe(expected);
      expect(isoDay(`${BASE}/right-wrong-ray/${t.slug}`)).toBe(expected);
    }
  });

  it("gives the Boone surfaces Boone's date and the hub the newest of all towns", async () => {
    const boone = await latestComparisonDate("boone");
    expect(isoDay(BASE)).toBe(boone);
    expect(isoDay(`${BASE}/right-wrong-ray`)).toBe(boone);

    const towns = await allTowns();
    const all = await Promise.all(towns.map((t) => latestComparisonDate(t.slug)));
    const newest = all.filter(Boolean).sort().pop();
    expect(isoDay(`${BASE}/weather`)).toBe(newest);
  });

  it("stamps /roads from the roads artifact's own generated_at", async () => {
    const generated = (await getRoadsForecast())?.generated_at;
    expect(generated).toBeTruthy();
    expect(at(`${BASE}/roads`).lastModified).toEqual(new Date(generated!));
  });

  it("keeps omitting the field on pages with no honest data date", () => {
    // A build date on these would be pure noise: nothing about them changed
    // because the site rebuilt. This is the half of the rule that predates the
    // 2026-07-28 change and must survive it.
    for (const url of ["/about", "/methodology", "/shop", "/api", "/resources", "/resources/articles"]) {
      expect(at(`${BASE}${url}`).lastModified, url).toBeUndefined();
    }
  });

  it("never stamps a data-driven URL with the build date", () => {
    const today = new Date().toISOString().slice(0, 10);
    // Comparisons grade a completed day, so a town's date is always in the past.
    // A match with today would mean the build clock leaked in.
    const towns = [...byUrl.keys()].filter((u) => u.startsWith(`${BASE}/weather/`));
    expect(towns.length).toBeGreaterThan(0);
    for (const u of towns) expect(isoDay(u), u).not.toBe(today);
  });

  it("carries a lastModified on every data-driven URL", () => {
    const dataDriven = [...byUrl.keys()].filter(
      (u) => u === BASE || u.startsWith(`${BASE}/weather`) || u.startsWith(`${BASE}/right-wrong-ray`) || u === `${BASE}/roads`,
    );
    // 1 root + 1 board + 1 roads + hub + 17 towns x 2 = 38 at the current registry.
    expect(dataDriven.length).toBeGreaterThan(30);
    for (const u of dataDriven) expect(at(u).lastModified, u).toBeInstanceOf(Date);
  });
});

describe("reports and tools registry", () => {
  it("keeps /roads and /report-card on a linked surface", () => {
    // H1/H2 of the 2026-07-28 audit: both had one inbound link site-wide. The
    // fix is a real entry in TOOLS, which /resources/reports renders. Removing
    // one re-orphans the page, so it fails here first.
    const hrefs = TOOLS.map((t) => t.href);
    expect(hrefs).toContain("/roads");
    expect(hrefs).toContain("/report-card");
    for (const t of TOOLS) {
      expect(t.title.length).toBeGreaterThan(0);
      expect(t.summary?.length ?? 0).toBeGreaterThan(0);
    }
    // Tools are standing pages, reports are dated one-offs; no double listing.
    for (const r of REPORTS) expect(hrefs).not.toContain(r.href);
  });
});
