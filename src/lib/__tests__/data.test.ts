import { describe, it, expect } from "vitest";
import { getLatestComparison, getScores, getBlogPosts, slugFromLink } from "@/lib/data";

describe("data readers", () => {
  it("reads the latest comparison with actuals", async () => {
    const c = await getLatestComparison();
    expect(c).not.toBeNull();
    expect(typeof c!.date).toBe("string");
    expect(c!.actuals).toBeTruthy();
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
  it("derives slug from a substack /p/ link", () => {
    expect(slugFromLink("https://x.substack.com/p/welcome-to-daves-sweater", "Welcome"))
      .toBe("welcome-to-daves-sweater");
  });
});
