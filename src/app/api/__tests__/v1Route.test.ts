// The v1 API's five endpoints are served by one catch-all route file, for the
// function-budget reason documented in that file. This exercises the dispatch
// against the real committed data, so a broken import or a renamed handler is
// a red test rather than a 404 in production.
import { describe, it, expect } from "vitest";
import { GET, OPTIONS } from "@/app/api/v1/[endpoint]/route";

function call(endpoint: string, query = "") {
  return GET(new Request(`https://davessweater.com/api/v1/${endpoint}${query}`), {
    params: Promise.resolve({ endpoint }),
  });
}

describe("/api/v1/[endpoint]", () => {
  it("serves the town registry", async () => {
    const res = await call("towns");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBeGreaterThan(0);
    expect(body.towns.some((t: { slug: string }) => t.slug === "boone")).toBe(true);
  });

  it("serves today, the forecast, the scoreboard and the verdict", async () => {
    for (const endpoint of ["today", "forecast", "scores", "verdict"]) {
      const res = await call(endpoint, "?town=boone");
      expect(res.status, `${endpoint} responded ${res.status}`).toBe(200);
      const body = await res.json();
      expect(body.town.slug, `${endpoint} named the wrong town`).toBe("boone");
    }
  });

  it("keeps each endpoint's own params working through the dispatch", async () => {
    const three = await (await call("forecast", "?town=boone&days=3")).json();
    expect(three.days).toBe(3);
    expect(three.forecast.length).toBeLessThanOrEqual(3);

    const bad = await call("forecast", "?town=boone&days=9");
    expect(bad.status).toBe(400);
  });

  it("passes an unknown town through to the handler's 404", async () => {
    const res = await call("today", "?town=atlantis");
    expect(res.status).toBe(404);
    expect((await res.json()).valid_towns).toContain("boone");
  });

  it("names the real endpoints when the endpoint segment is not one", async () => {
    const res = await call("sweaters");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.valid_endpoints).toEqual([
      "forecast", "scores", "today", "tourism", "towns", "verdict",
    ]);
  });

  it("serves the Busy-ness Index against the real committed archive", async () => {
    const res = await call("tourism");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.region).toBe("North Carolina High Country");
    expect(body.horizon.length).toBeGreaterThan(0);
    expect(body.scale.max).toBe(100);
    // Every scored day carries a band the page can render.
    for (const d of body.horizon) {
      expect(["calm", "typical", "busy", "slammed"]).toContain(d.band);
    }
    // The weekend call names a date inside the horizon it came from.
    expect(body.horizon.some((d: { date: string }) => d.date === body.weekend.call.date)).toBe(true);
    // summary detail withholds the component breakdown.
    expect(body.horizon[0].components).toBeUndefined();
  });

  it("adds components, events and lodging only at detail=full", async () => {
    const body = await (await call("tourism", "?detail=full")).json();
    expect(body.horizon[0].components).toBeDefined();
    expect(Array.isArray(body.events)).toBe(true);
    expect(body).toHaveProperty("lodging");
    expect(body).toHaveProperty("cross_confirmed");
  });

  it("rejects a detail value it does not serve", async () => {
    expect((await call("tourism", "?detail=everything")).status).toBe(400);
  });

  it("answers the CORS preflight", async () => {
    const res = OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
