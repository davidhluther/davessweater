import { describe, it, expect } from "vitest";
import { sanitizePostHtml } from "@/lib/html";

describe("sanitizePostHtml", () => {
  it("keeps content tags but strips scripts", () => {
    const out = sanitizePostHtml('<p>hi</p><h4>head</h4><script>alert(1)</script><a href="x">l</a>');
    expect(out).toContain("<p>hi</p>");
    expect(out).toContain("<h4>head</h4>");
    expect(out.toLowerCase()).not.toContain("<script");
  });
});
