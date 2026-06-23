import { describe, it, expect } from "vitest";
import { classifyScreenshotSource, REAL_APPLE_MIN_BYTES } from "@/lib/screenshot";

describe("classifyScreenshotSource", () => {
  it("treats large files as the real Apple Weather screenshot", () => {
    expect(classifyScreenshotSource(2_500_000)).toBe("apple");
    expect(classifyScreenshotSource(REAL_APPLE_MIN_BYTES)).toBe("apple");
  });
  it("treats small files as the Open-Meteo-rendered fallback", () => {
    expect(classifyScreenshotSource(90_000)).toBe("openmeteo");
  });
});
