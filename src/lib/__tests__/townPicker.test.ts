import { describe, it, expect } from "vitest";
import { navHrefForTown, normalizePath, pickerState, townHrefOn } from "@/lib/townPicker";

const TOWNS = [
  { slug: "boone", name: "Boone" },
  { slug: "blowing-rock", name: "Blowing Rock" },
  { slug: "deep-gap", name: "Deep Gap" },
];

describe("townHrefOn", () => {
  it("routes Boone to its legacy top-level URLs (no /weather/boone twin)", () => {
    expect(townHrefOn("boone", "weather")).toBe("/");
    expect(townHrefOn("boone", "right-wrong-ray")).toBe("/right-wrong-ray");
  });
  it("routes every other town under the requested surface", () => {
    expect(townHrefOn("deep-gap", "weather")).toBe("/weather/deep-gap");
    expect(townHrefOn("deep-gap", "right-wrong-ray")).toBe("/right-wrong-ray/deep-gap");
  });
});

describe("navHrefForTown", () => {
  it("leaves the canonical Boone hrefs alone with no remembered town", () => {
    // This is what the prerendered HTML has to keep shipping.
    expect(navHrefForTown("/", null)).toBe("/");
    expect(navHrefForTown("/right-wrong-ray", null)).toBe("/right-wrong-ray");
  });

  it("points both primary links at the remembered town", () => {
    expect(navHrefForTown("/", "deep-gap")).toBe("/weather/deep-gap");
    expect(navHrefForTown("/right-wrong-ray", "deep-gap")).toBe("/right-wrong-ray/deep-gap");
  });

  it("keeps Boone on its legacy top-level URLs when Boone is the remembered town", () => {
    expect(navHrefForTown("/", "boone")).toBe("/");
    expect(navHrefForTown("/right-wrong-ray", "boone")).toBe("/right-wrong-ray");
  });

  it("does not touch links that are not per-town surfaces", () => {
    for (const href of ["/weather", "/resources", "/shop", "/api"]) {
      expect(navHrefForTown(href, "deep-gap")).toBe(href);
    }
  });
});

describe("normalizePath", () => {
  it("strips trailing slashes, queries, and hashes down to a bare path", () => {
    expect(normalizePath("/weather/")).toBe("/weather");
    expect(normalizePath("/weather?x=1")).toBe("/weather");
    expect(normalizePath("/weather#top")).toBe("/weather");
    expect(normalizePath("/")).toBe("/");
    expect(normalizePath(null)).toBe("/");
  });
});

describe("pickerState", () => {
  it("reads Boone on the homepage and on Boone's scoreboard", () => {
    expect(pickerState("/", TOWNS)).toEqual({ surface: "weather", slug: "boone", label: "Boone" });
    expect(pickerState("/right-wrong-ray", TOWNS)).toEqual({
      surface: "right-wrong-ray", slug: "boone", label: "Boone",
    });
  });

  it("reads the current town on a town page, keeping the surface", () => {
    expect(pickerState("/weather/blowing-rock", TOWNS)).toEqual({
      surface: "weather", slug: "blowing-rock", label: "Blowing Rock",
    });
    expect(pickerState("/right-wrong-ray/deep-gap", TOWNS)).toEqual({
      surface: "right-wrong-ray", slug: "deep-gap", label: "Deep Gap",
    });
  });

  it("reads 'All towns' on the /weather hub", () => {
    expect(pickerState("/weather", TOWNS)).toEqual({ surface: "weather", slug: null, label: "All towns" });
  });

  it("stays a plain menu on pages with no location context", () => {
    for (const p of ["/shop", "/resources/articles", "/methodology", "/api"]) {
      expect(pickerState(p, TOWNS)).toEqual({ surface: "weather", slug: null, label: "Towns" });
    }
  });

  it("never invents a current town for an unknown slug, but keeps the surface", () => {
    expect(pickerState("/weather/nowhere-ville", TOWNS)).toEqual({
      surface: "weather", slug: null, label: "Towns",
    });
    expect(pickerState("/right-wrong-ray/nowhere-ville", TOWNS)).toEqual({
      surface: "right-wrong-ray", slug: null, label: "Towns",
    });
  });

  it("tolerates trailing slashes, query strings, and a null pathname", () => {
    expect(pickerState("/weather/deep-gap/", TOWNS).slug).toBe("deep-gap");
    expect(pickerState("/weather/?x=1", TOWNS).label).toBe("All towns");
    expect(pickerState(null, TOWNS).label).toBe("Boone");
  });

  it("falls back to a Boone label if the registry somehow omits Boone", () => {
    expect(pickerState("/", [{ slug: "todd", name: "Todd" }]).label).toBe("Boone");
  });
});
