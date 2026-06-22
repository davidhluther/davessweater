import { describe, it, expect } from "vitest";
import { sanitizePostHtml } from "@/lib/html";

describe("sanitizePostHtml", () => {
  it("keeps content tags but strips scripts", () => {
    const out = sanitizePostHtml('<p>hi</p><h4>head</h4><script>alert(1)</script><a href="x">l</a>');
    expect(out).toContain("<p>hi</p>");
    expect(out).toContain("<h4>head</h4>");
    expect(out.toLowerCase()).not.toContain("<script");
  });
  it("strips inline event handlers", () => {
    const out = sanitizePostHtml('<p onclick="alert(1)">hi</p><img src="x" onerror="alert(1)" alt="">');
    expect(out).not.toMatch(/on\w+=/i);
  });
  it("strips javascript: and data: href schemes", () => {
    const out = sanitizePostHtml('<a href="javascript:alert(1)">bad</a><a href="data:text/html,x">bad2</a>');
    expect(out).not.toContain("javascript:");
    expect(out).not.toContain("data:");
  });
});
