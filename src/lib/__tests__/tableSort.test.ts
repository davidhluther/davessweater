import { describe, it, expect } from "vitest";
import { sortRows } from "@/lib/tableSort";

const rows = [
  { label: "Ray's Weather", avg: 65.5, days: 109 },
  { label: "Open-Meteo", avg: 91.6, days: 474 },
];

describe("sortRows", () => {
  it("sorts by a numeric column descending then ascending", () => {
    expect(sortRows(rows, "avg", "desc").map((r) => r.label)).toEqual(["Open-Meteo", "Ray's Weather"]);
    expect(sortRows(rows, "avg", "asc").map((r) => r.label)).toEqual(["Ray's Weather", "Open-Meteo"]);
  });
  it("sorts by a string column and does not mutate input", () => {
    const out = sortRows(rows, "label", "asc");
    expect(out.map((r) => r.label)).toEqual(["Open-Meteo", "Ray's Weather"]);
    expect(rows[0].label).toBe("Ray's Weather");
  });
});
