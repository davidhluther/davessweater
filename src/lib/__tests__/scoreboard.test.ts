import { describe, it, expect } from "vitest";
import { scoreboardRows } from "@/lib/scoreboard";

describe("scoreboardRows", () => {
  it("maps totals to labeled rows with avg = total_score/days", () => {
    const rows = scoreboardRows({ entries: [], totals: {
      openmeteo: { right: 104, wrong: 0, meh: 2, total_score: 9700.8, days: 106 },
    }});
    expect(rows[0]).toMatchObject({ label: "Open-Meteo", record: "104W - 2M - 0L", days: 106 });
    expect(rows[0].avg).toBeCloseTo(91.5, 1);
  });
});
