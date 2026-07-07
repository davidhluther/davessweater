import { describe, it, expect } from "vitest";
import { getLatestComparison, getScores, getBlogPosts, getBlogPost, slugFromLink, postSlug, postCategoryOf, getComparisonWindow } from "@/lib/data";
import { faqPage } from "@/lib/schema";

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

describe("native markdown posts", () => {
  it("loads native posts with explicit slug, category, and rendered HTML", async () => {
    const posts = await getBlogPosts();
    const flagship = posts.find((p) => p.slug === "is-rays-weather-accurate");
    expect(flagship).toBeTruthy();
    expect(postSlug(flagship!)).toBe("is-rays-weather-accurate");
    expect(postCategoryOf(flagship!)).toBe("articles");
    // Markdown body was rendered to HTML (tables + headings), not left as markdown.
    expect(flagship!.content ?? "").toContain("<table>");
    expect(flagship!.content ?? "").not.toMatch(/^#\s/m);
    // Per-post SEO meta is carried through for generateMetadata.
    expect((flagship!.metaTitle ?? "").length).toBeGreaterThan(0);
    expect((flagship!.metaDescription ?? "").length).toBeGreaterThan(0);
  });
  it("finds a native post by its explicit slug", async () => {
    const post = await getBlogPost("how-accurate-is-a-10-day-forecast");
    expect(post).not.toBeNull();
    expect(postCategoryOf(post!)).toBe("articles");
  });
  it("still derives category for feed posts without an explicit category", async () => {
    const posts = await getBlogPosts();
    const feed = posts.find((p) => !p.slug);
    if (feed) expect(["articles", "news"]).toContain(postCategoryOf(feed));
  });
  it("extracts FAQ question/answer pairs for FAQPage schema", async () => {
    const post = await getBlogPost("is-rays-weather-accurate");
    expect(post!.faqs?.length ?? 0).toBeGreaterThanOrEqual(5);
    const first = post!.faqs![0];
    expect(first.q).toMatch(/\?$/); // questions end with a question mark
    expect(first.a.length).toBeGreaterThan(20);
    // Answers are flattened to plain text — no markdown link syntax leaks into schema.
    expect(post!.faqs!.some((f) => /\]\(/.test(f.a))).toBe(false);
  });
  it("builds valid FAQPage JSON-LD from parsed FAQs", async () => {
    const post = await getBlogPost("is-rays-weather-accurate");
    const ld = faqPage(post!.faqs!);
    expect(ld["@type"]).toBe("FAQPage");
    expect(ld.mainEntity.length).toBe(post!.faqs!.length);
    expect(ld.mainEntity[0]["@type"]).toBe("Question");
    expect(ld.mainEntity[0].acceptedAnswer["@type"]).toBe("Answer");
    // Raw ampersands/angle brackets are kept out of the schema text.
    const blob = JSON.stringify(ld);
    expect(blob).not.toMatch(/[<>]/);
    expect(blob).not.toMatch(/ & /);
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
