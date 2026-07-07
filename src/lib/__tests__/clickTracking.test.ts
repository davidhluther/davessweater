import { describe, it, expect } from "vitest";
import { buildClickEventParams } from "@/lib/clickTracking";

describe("buildClickEventParams", () => {
  it("labels from visible text, collapsing whitespace", () => {
    const p = buildClickEventParams({ tagName: "a", text: "  How Ray  did \n ", href: "/right-wrong-ray" }, "/");
    expect(p?.link_text).toBe("How Ray did");
    expect(p?.element_type).toBe("link");
  });

  it("prefers an explicit data-track-label over visible text", () => {
    const p = buildClickEventParams(
      { tagName: "button", text: "Click here", trackLabel: "nav-resources-toggle" },
      "/"
    );
    expect(p?.link_text).toBe("nav-resources-toggle");
  });

  it("falls back to aria-label for icon-only elements with no text", () => {
    const p = buildClickEventParams({ tagName: "button", text: "", ariaLabel: "Open menu" }, "/");
    expect(p?.link_text).toBe("Open menu");
  });

  it("falls back to the href when there is no text or aria-label", () => {
    const p = buildClickEventParams({ tagName: "a", href: "/methodology" }, "/right-wrong-ray");
    expect(p?.link_text).toBe("/methodology");
    expect(p?.link_url).toBe("/methodology");
  });

  it("returns null when there is nothing meaningful to report", () => {
    expect(buildClickEventParams({ tagName: "button" }, "/")).toBeNull();
    expect(buildClickEventParams({ tagName: "a", text: "  " }, "/")).toBeNull();
  });

  it("classifies relative (internal) links as not outbound", () => {
    const p = buildClickEventParams({ tagName: "a", text: "Methodology", href: "/methodology" }, "/");
    expect(p?.outbound).toBe(false);
  });

  it("classifies absolute http(s) links as outbound", () => {
    const p = buildClickEventParams(
      { tagName: "a", text: "Fourthwall", href: "https://daves-sweater-shop.fourthwall.com/" },
      "/shop"
    );
    expect(p?.outbound).toBe(true);
  });

  it("classifies mailto/tel links as outbound", () => {
    expect(buildClickEventParams({ tagName: "a", text: "Email", href: "mailto:hi@davessweater.com" }, "/")?.outbound).toBe(true);
    expect(buildClickEventParams({ tagName: "a", text: "Call", href: "tel:+15551234567" }, "/")?.outbound).toBe(true);
  });

  it("maps element_type by tag: link, button, toggle (details/summary), and a generic fallback", () => {
    expect(buildClickEventParams({ tagName: "a", text: "x", href: "/a" }, "/")?.element_type).toBe("link");
    expect(buildClickEventParams({ tagName: "button", text: "x" }, "/")?.element_type).toBe("button");
    expect(buildClickEventParams({ tagName: "summary", text: "What does the 118-day leaderboard show?" }, "/")?.element_type).toBe(
      "toggle"
    );
    expect(buildClickEventParams({ tagName: "div", text: "x" }, "/")?.element_type).toBe("element");
  });

  it("truncates very long labels instead of shipping unbounded text to GA4", () => {
    const p = buildClickEventParams({ tagName: "button", text: "x".repeat(500) }, "/");
    expect(p?.link_text.length).toBe(100);
  });

  it("carries the current page path through unchanged", () => {
    const p = buildClickEventParams(
      { tagName: "a", text: "Report card", href: "/resources/articles/rays-weather-report-card-june-2026" },
      "/resources/articles/is-rays-weather-accurate"
    );
    expect(p?.page_path).toBe("/resources/articles/is-rays-weather-accurate");
  });

  it("omits link_url entirely for hrefless elements (buttons)", () => {
    const p = buildClickEventParams({ tagName: "button", text: "Check my view" }, "/reports/fireworks-fourth-july-2026");
    expect(p).not.toHaveProperty("link_url");
    expect(p?.outbound).toBe(false);
  });
});
