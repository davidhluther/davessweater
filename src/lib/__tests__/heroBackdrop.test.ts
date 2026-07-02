import { describe, it, expect } from "vitest";
import { wxVariant } from "@/lib/heroBackdrop";

describe("wxVariant", () => {
  it("maps precip types ahead of temperature", () => {
    expect(wxVariant({ precip: "rain", high: 90 })).toBe("wx-rain");
    expect(wxVariant({ precip: "snow", high: 30 })).toBe("wx-snow");
    expect(wxVariant({ precip: "mixed", high: 34 })).toBe("wx-mixed");
  });

  it("splits dry days on the published sweater-weather boundaries", () => {
    expect(wxVariant({ precip: "none", high: 75 })).toBe("wx-hot");
    expect(wxVariant({ precip: "none", high: 74 })).toBe("wx-mild");
    expect(wxVariant({ precip: "none", high: 55 })).toBe("wx-mild");
    expect(wxVariant({ precip: "none", high: 54 })).toBe("wx-crisp");
  });

  it("falls back to the near-silent mild variant without a composite", () => {
    expect(wxVariant(null)).toBe("wx-mild");
  });

  it("treats an unknown precip key as a dry day", () => {
    expect(wxVariant({ precip: "hail", high: 60 })).toBe("wx-mild");
  });
});
