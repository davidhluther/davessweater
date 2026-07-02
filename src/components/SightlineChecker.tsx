"use client";
// "Where should you go?" — the interactive terrain + sky checker on
// /fireworks. Everything heavy runs in the browser: elevation comes from the
// free AWS terrain tiles (CORS-open, fetched directly and decoded on a
// canvas), the line-of-sight math is src/lib/sightline.ts, and the night's
// sky verdicts + verified public spots arrive as props from the server page.
// The only server involvement is the /api/geocode passthrough when someone
// types an address instead of sharing their location. Nothing is stored.
import { useEffect, useRef, useState } from "react";
import { VENUES } from "@/lib/fireworksVenues";
import type { Verdict } from "@/lib/fireworks";
import {
  BURST_FINALE_M, BURST_TYPICAL_M, MARGIN_NOISE_M, TILE_Z,
  bestGroundNear, ftFromM, ftFromM50, losToBurst, miFromKm, miFromM,
  terrariumElevationM, tileCoords, verdictFromMargins,
  type ElevFn, type SightVerdict,
} from "@/lib/sightline";

export interface CheckerShowSky {
  id: string;
  name: string;
  verdict: Verdict;
}

export interface CheckerSpot {
  name: string;
  verdicts: Record<string, SightVerdict>;
}

interface ShowResult {
  id: string;
  name: string;
  distanceMi: number;
  verdict: SightVerdict;
  margin90: number; // meters, converted at display
  margin150: number;
  blockerMi: number | null;
  requiredAGLM: number;
}

type Status =
  | { kind: "idle" }
  | { kind: "working"; message: string }
  | { kind: "error"; message: string }
  | { kind: "done"; results: ShowResult[]; where: string; groundM: number };

const SIGHT_UI: Record<SightVerdict, { label: string; cls: string }> = {
  clear: { label: "Clear View", cls: "bg-green-700 text-white" },
  "finale-only": { label: "Limited View", cls: "bg-orange-600 text-white" },
  marginal: { label: "Limited View", cls: "bg-orange-600 text-white" },
  blocked: { label: "Blocked View", cls: "border border-border bg-surface text-muted" },
};

const SKY_UI: Record<Verdict, { label: string; cls: string }> = {
  clear: { label: "Clear Skies", cls: "bg-green-700 text-white" },
  iffy: { label: "Iffy Skies", cls: "bg-orange-600 text-white" },
  obstructed: { label: "Bad Skies", cls: "bg-red-700 text-white" },
  unavailable: { label: "No Forecast", cls: "border border-border bg-surface text-muted" },
};

function detail(r: ShowResult): string {
  switch (r.verdict) {
    case "clear":
      return `Clears the worst ridge by about ${ftFromM(r.margin90)} ft.`;
    case "marginal":
      return `Within ±${ftFromM50(MARGIN_NOISE_M)} ft of the ridgeline; trees and rooftops decide. Treat it as a maybe.`;
    case "finale-only":
      return `Typical shells hide behind terrain ${r.blockerMi} mi out, but the big finale bursts (about ${ftFromM50(BURST_FINALE_M)} ft up) clear by about ${ftFromM(r.margin150)} ft.`;
    case "blocked":
      return `Terrain ${r.blockerMi} mi out blocks it; bursts would need about ${ftFromM(r.requiredAGLM)} ft to show.`;
  }
}

const SIGHT_SCORE: Record<SightVerdict, number> = { clear: 3, "finale-only": 2, marginal: 1, blocked: 0 };
const SKY_SCORE: Record<Verdict, number> = { clear: 2, iffy: 1, unavailable: 1, obstructed: 0 };

function recommendation(results: ShowResult[], sky: CheckerShowSky[], spots: CheckerSpot[]): string {
  const skyOf = (id: string): Verdict => sky.find((s) => s.id === id)?.verdict ?? "unavailable";
  const viable = results
    .filter((r) => SIGHT_SCORE[r.verdict] > 0)
    .sort(
      (a, b) =>
        SIGHT_SCORE[b.verdict] - SIGHT_SCORE[a.verdict] ||
        SKY_SCORE[skyOf(b.id)] - SKY_SCORE[skyOf(a.id)] ||
        a.distanceMi - b.distanceMi,
    );
  if (viable.length) {
    const best = viable[0];
    const s = skyOf(best.id);
    const sightNote =
      best.verdict === "clear" ? "" : best.verdict === "finale-only" ? " (limited view, finale shells only)" : " (limited view; scout it in daylight)";
    const skyNote =
      s === "unavailable" ? "" : s === "clear" ? ", and the skies look clear" : `, though the skies look ${s === "obstructed" ? "bad" : "iffy"}`;
    return `The call from here: ${best.name} Fireworks${sightNote}, ${best.distanceMi} mi from you${skyNote}.`;
  }
  // Nothing shows from this spot; point at a verified public spot instead,
  // best sky first.
  const showsBySky = [...sky].sort((a, b) => SKY_SCORE[b.verdict] - SKY_SCORE[a.verdict]);
  for (const show of showsBySky) {
    const spot = spots.find((sp) => sp.verdicts[show.id] === "clear");
    if (spot) {
      return `Nothing clears from your spot; the mountains win this round. The sure thing: head to ${spot.name}, which has a computed clear line on the ${show.name} Fireworks${show.verdict !== "unavailable" ? ` (${show.verdict === "clear" ? "clear" : show.verdict === "obstructed" ? "bad" : "iffy"} skies)` : ""}.`;
    }
  }
  return "Nothing clears from your spot, and no tested public spot bails you out. Pick a show and attend in person.";
}

export default function SightlineChecker({ sky, spots }: { sky: CheckerShowSky[]; spots: CheckerSpot[] }) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [address, setAddress] = useState("");
  const tilesRef = useRef(new Map<string, ImageData>());

  const getElev: ElevFn = async (lat, lon) => {
    const { tx, ty, px, py } = tileCoords(lat, lon, TILE_Z);
    const key = `${tx}/${ty}`;
    let img = tilesRef.current.get(key);
    if (!img) {
      const res = await fetch(
        `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${TILE_Z}/${tx}/${ty}.png`,
      );
      if (!res.ok) throw new Error("a terrain tile wouldn't load; try again in a minute");
      const bmp = await createImageBitmap(await res.blob());
      const canvas = document.createElement("canvas");
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("this browser blocked canvas reads");
      ctx.drawImage(bmp, 0, 0);
      img = ctx.getImageData(0, 0, bmp.width, bmp.height);
      tilesRef.current.set(key, img);
    }
    const i = (py * img.width + px) * 4;
    return terrariumElevationM(img.data[i], img.data[i + 1], img.data[i + 2]);
  };

  async function runCheck(lat: number, lon: number, where: string) {
    try {
      setStatus({ kind: "working", message: "Reading the terrain around you…" });
      const ground = await bestGroundNear(getElev, { lat, lon });
      const results: ShowResult[] = [];
      for (const v of VENUES) {
        setStatus({ kind: "working", message: `Checking the ${v.name} show…` });
        const r90 = await losToBurst(getElev, { lat, lon }, ground, { lat: v.lat, lon: v.lon }, BURST_TYPICAL_M);
        const r150 = await losToBurst(getElev, { lat, lon }, ground, { lat: v.lat, lon: v.lon }, BURST_FINALE_M);
        results.push({
          id: v.id,
          name: v.name,
          distanceMi: miFromM(r90.distanceM),
          verdict: verdictFromMargins(r90.marginM, r150.marginM),
          margin90: r90.marginM,
          margin150: r150.marginM,
          blockerMi: r90.blockerKm === null ? null : miFromKm(r90.blockerKm),
          requiredAGLM: r90.requiredAGLM,
        });
      }
      setStatus({ kind: "done", results, where, groundM: ground });
    } catch (e) {
      setStatus({ kind: "error", message: e instanceof Error ? e.message : "the computation failed" });
    }
  }

  function checkMyLocation() {
    if (!("geolocation" in navigator)) {
      setStatus({ kind: "error", message: "this browser doesn't offer location; use the address box" });
      return;
    }
    setStatus({ kind: "working", message: "Getting your location…" });
    navigator.geolocation.getCurrentPosition(
      (pos) => void runCheck(pos.coords.latitude, pos.coords.longitude, "your location"),
      () => setStatus({ kind: "error", message: "location denied; the address box works too" }),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  async function geocodeAndRun(q: string) {
    setStatus({ kind: "working", message: "Finding that address…" });
    try {
      const res = await fetch(`/api/geocode?address=${encodeURIComponent(q)}`);
      const data = (await res.json()) as { lat?: number; lon?: number; matched?: string; error?: string };
      if (!res.ok || data.lat === undefined || data.lon === undefined) {
        throw new Error(
          data.error === "no match"
            ? "couldn't place that address; include the town and NC"
            : "the address lookup is unavailable right now; try \"use my location\"",
        );
      }
      await runCheck(data.lat, data.lon, data.matched ?? q);
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "lookup failed" });
    }
  }

  async function checkAddress(e: React.FormEvent) {
    e.preventDefault();
    const q = address.trim();
    if (!q) return;
    await geocodeAndRun(q);
  }

  // Deep-link handoff (the Reports-page teaser): /fireworks?check=me runs the
  // location path, ?check=<address> geocodes and runs. Read from
  // window.location instead of useSearchParams so the static page never takes
  // a CSR bailout; runs once, on mount, only when the param is present.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("check");
    if (!q) return;
    // Deferred a tick so the trigger runs after paint instead of setting
    // state synchronously inside the effect (react-hooks/set-state-in-effect).
    const t = setTimeout(() => {
      if (q === "me") {
        checkMyLocation();
      } else {
        setAddress(q);
        void geocodeAndRun(q);
      }
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={checkMyLocation}
          disabled={status.kind === "working"}
          className="rounded-md bg-teal-700 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:opacity-50"
        >
          Use My Location
        </button>
        <span className="text-sm text-muted">or</span>
        <form onSubmit={checkAddress} className="flex min-w-0 flex-1 gap-2">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="street address, town, NC"
            aria-label="Address to check"
            className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={status.kind === "working"}
            className="rounded-md border border-teal-700 px-3.5 py-2 text-sm font-semibold text-teal transition-colors hover:bg-surface disabled:opacity-50"
          >
            Check
          </button>
        </form>
      </div>

      {status.kind === "working" && <p className="mt-3 text-sm text-muted">{status.message}</p>}
      {status.kind === "error" && <p className="mt-3 text-sm text-orange-600">Didn&apos;t work: {status.message}.</p>}
      {status.kind === "done" && (
        <div className="mt-4">
          <p className="text-sm text-muted">
            From <strong className="text-foreground">{status.where}</strong> (ground ≈{" "}
            {ftFromM(status.groundM)} ft, taken at the highest point within about 150 ft; find the good
            corner):
          </p>
          <p className="mt-2 rounded-md border-l-4 border-orange bg-surface px-3 py-2 text-sm">
            {recommendation(status.results, sky, spots)}
          </p>
          <ul className="mt-3 space-y-2">
            {status.results.map((r) => {
              const skyV = sky.find((s) => s.id === r.id)?.verdict;
              return (
                <li key={r.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
                  <strong className="font-semibold">{r.name} Fireworks</strong>
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${SIGHT_UI[r.verdict].cls}`}>
                    {SIGHT_UI[r.verdict].label}
                  </span>
                  {skyV && (
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${SKY_UI[skyV].cls}`}>
                      {SKY_UI[skyV].label}
                    </span>
                  )}
                  <span className="text-muted">{r.distanceMi} mi from you. {detail(r)}</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-muted">
            Terrain only: the model is bare earth (USGS, about 33 ft resolution), so it cannot see your
            neighbor&apos;s oaks or the building across the street. &quot;Clear View&quot; means the
            mountains aren&apos;t your problem. We store, log, and track nothing: the math runs in your
            browser, a typed address is converted to coordinates once by the US Census Bureau&apos;s public
            geocoder and then forgotten, and a shared location never leaves the page.
          </p>
        </div>
      )}
    </div>
  );
}
