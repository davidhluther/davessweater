import { describe, it, expect } from "vitest";
import { getLatestComparison, getScores, getBlogPosts, getBlogPost, slugFromLink, getComparisonWindow } from "@/lib/data";

describe("data readers", () => {
  it("reads the latest comparison with actuals", async () => {
    const c = await getLatestComparison();
    expect(c).not.toBeNull();
    expect(typeof c!.date).toBe("string");
    expect(c!.actuals).toBeTruthy();
    expect(c!.actuals.high_f).toBeDefined();
  });
  it("reads scores totals", async () => {
    const s = await getScores();
    expect(s).not.toBeNull();
    expect(s!.totals.openmeteo?.days).toBeGreaterThan(0);
  });
  it("reads blog posts", async () => {
    const posts = await getBlogPosts();
    expect(Array.isArray(posts)).toBe(true);
    expect(posts.length).toBeGreaterThan(0);
  });
  it("finds a blog post by slug", async () => {
    const post = await getBlogPost("welcome-to-daves-sweater");
    expect(post).not.toBeNull();
    expect(post!.title.length).toBeGreaterThan(0);
  });
  it("derives slug from a substack /p/ link", () => {
    expect(slugFromLink("https://x.substack.com/p/welcome-to-daves-sweater", "Welcome"))
      .toBe("welcome-to-daves-sweater");
  });
});

describe("getComparisonWindow", () => {
  it("loads existing comparison files and skips missing dates", async () => {
    const out = await getComparisonWindow(["2026-06-22", "1999-01-01"]);
    expect(out.length).toBe(1);
    expect(out[0].date).toBe("2026-06-22");
    expect(out[0].sources).toBeTruthy();
  });
});
