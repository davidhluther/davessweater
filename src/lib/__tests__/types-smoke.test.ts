import { describe, it, expect } from "vitest";
import type { Scores, ScoreBreakdownField } from "@/lib/types";

describe("types", () => {
  it("Scores carries coverage keyed by source then field", () => {
    const s: Scores = {
      entries: [],
      totals: {},
      coverage: { raysweather: { precip: { provided: 0, days: 109 } } },
    };
    expect(s.coverage?.raysweather?.precip?.provided).toBe(0);
  });
  it("ScoreBreakdownField matches the engine output", () => {
    const f: ScoreBreakdownField = { points: null, max: 20, scored: false, predicted: null, actual: 0.12, error: null, unit: "in_liquid" };
    expect(f.scored).toBe(false);
  });
});
