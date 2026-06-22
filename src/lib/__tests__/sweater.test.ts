import { describe, it, expect } from "vitest";
import { sweaterFromEffective, effectiveTemp, rayCount } from "@/lib/sweater";

describe("sweater logic", () => {
  it("maps effective temp to 0-5 score bands", () => {
    expect(sweaterFromEffective(34).score).toBe(5);
    expect(sweaterFromEffective(35).score).toBe(4);
    expect(sweaterFromEffective(54).score).toBe(3);
    expect(sweaterFromEffective(64).score).toBe(2);
    expect(sweaterFromEffective(74).score).toBe(1);
    expect(sweaterFromEffective(75).score).toBe(0);
  });
  it("blends high and current 50/50", () => {
    expect(effectiveTemp(70, 50)).toBe(60);
  });
  it("rayCount = round(score/20) capped at 5", () => {
    expect(rayCount(96.3)).toBe(5);
    expect(rayCount(59.6)).toBe(3);
    expect(rayCount(0)).toBe(0);
  });
});
