// compute_terrain.mjs — offline terrain precompute for /fireworks.
//
// Produces data/terrain.json:
//   horizons:   per-venue western horizon profile (az 235–325°, elevation
//               angle in degrees) → the build computes "last direct sun" per
//               venue with src/lib/solar.ts (terrain is static; re-run only
//               when the venue list changes).
//   viewpoints: line-of-sight results from a curated list of PUBLIC spots to
//               every show, at typical (90 m) and finale (150 m) burst
//               heights → the page's "verified sightlines" table.
//
// Elevation: AWS Open Data terrain tiles (terrarium PNGs, USGS NED 10m
// bare-earth, z13). Formulas mirror src/lib/sightline.ts — keep in sync.
// Venue coords mirror src/lib/fireworksVenues.ts (ids must match).
//
// Run:  node scripts/compute_terrain.mjs   (needs network; ~1–2 min)

import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import sharp from "sharp";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "terrain.json");

const Z = 13;
const R_EFF = 6371000 / (1 - 0.13);
const EYE = 2;
const BURSTS = [90, 150];

// Mirrors src/lib/fireworksVenues.ts.
const VENUES = {
  "boone": { lat: 36.2049, lon: -81.6507 },
  "tweetsie": { lat: 36.1708, lon: -81.6485 },
  "beech-mountain": { lat: 36.1961, lon: -81.8778 },
  "west-jefferson": { lat: 36.3892, lon: -81.4813 },
};

// Public, findable spots only. Every pin needs geocoded or profile-verified
// provenance. `environment` feeds the clutter allowance (see lib/sightline.ts):
// "built" and "wooded" spots must clear terrain by an extra ~50 ft before we
// call their view anything but blocked — the DEM cannot see buildings or trees.
const VIEWPOINTS = [
  { id: "rec-center", name: "Watauga County Rec Center lot", lat: 36.2052, lon: -81.6497, environment: "open",
    note: "The official parking for the Boone show; you are basically at the launch." },
  // Coordinate provenance matters: a pin 800 m off once flagged this lot
  // "blocked" behind a knoll it isn't behind (caught by owner ground truth,
  // 2026-07-02). Location: off Dale St, verified against the terrain profile.
  { id: "state-farm-lot", name: "App State's State Farm lot", lat: 36.2055, lon: -81.6570, environment: "open",
    note: "The town's listed overflow parking off Dale St, a local favorite, and the math agrees." },
  // 604 W King St, Census-geocoded.
  { id: "jones-house", name: "Jones House lawn, King St", lat: 36.2183, lon: -81.6831, environment: "built",
    note: "Downtown Boone, where the daytime festivities are, and where the buildings are." },
  { id: "howards-knob", name: "Howard's Knob Park", lat: 36.2288, lon: -81.6807, environment: "wooded",
    note: "County park above town. Wooded summit, and the gate has historically closed around dark; verify before planning on it." },
  { id: "horn-west", name: "Daniel Boone Park (Horn in the West)", lat: 36.2099, lon: -81.6702, environment: "wooded",
    note: "The Horn in the West grounds, just east of downtown, under a lot of trees." },
  { id: "boone-mall", name: "Boone Mall lot", lat: 36.2039, lon: -81.6670, environment: "open",
    note: "The big open lot on the US-321 corridor." },
  { id: "watauga-high", name: "Watauga High School lots", lat: 36.2194, lon: -81.6515, environment: "open",
    note: "Large campus lots a mile north of the launch. School property; holiday access is customary, not promised." },
  { id: "tweetsie-lot", name: "Tweetsie parking lot", lat: 36.1728, lon: -81.6503, environment: "open",
    note: "The official free viewing for the Tweetsie show." },
  // 1036 Main St, Census-geocoded.
  { id: "br-memorial", name: "Memorial Park, Blowing Rock", lat: 36.1344, lon: -81.6780, environment: "built",
    note: "Downtown Blowing Rock's Main Street park." },
];

// A verdict that flips when the pin moves ±100 m is a coordinate-precision
// problem, not a terrain fact — flag it so it renders as a maybe, not a claim.
const SENS_OFFSETS = [[100, 0], [-100, 0], [0, 100], [0, -100]];
const marginClass = (m) => (m >= 15 ? "clear" : m > -15 ? "noise" : "neg");

const tiles = new Map();
async function tile(x, y) {
  const key = `${x}/${y}`;
  if (!tiles.has(key)) {
    const res = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${x}/${y}.png`);
    if (!res.ok) throw new Error(`tile ${key}: HTTP ${res.status}`);
    const { data, info } = await sharp(Buffer.from(await res.arrayBuffer()))
      .raw().toBuffer({ resolveWithObject: true });
    tiles.set(key, { data, ch: info.channels, w: info.width });
  }
  return tiles.get(key);
}
async function elev(lat, lon) {
  const n = 2 ** Z;
  const x = ((lon + 180) / 360) * n;
  const rad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
  const tx = Math.floor(x), ty = Math.floor(y);
  const t = await tile(tx, ty);
  const px = Math.min(255, Math.floor((x - tx) * 256));
  const py = Math.min(255, Math.floor((y - ty) * 256));
  const i = (py * t.w + px) * t.ch;
  return t.data[i] * 256 + t.data[i + 1] + t.data[i + 2] / 256 - 32768;
}

const toRad = (d) => (d * Math.PI) / 180;
function haversine(a, b) {
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(s));
}
const lerp = (a, b, t) => ({ lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t });

async function bestGroundNear(p, boxM = 50) {
  let best = -Infinity;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    best = Math.max(best, await elev(
      p.lat + ((dy * boxM) / 2 / 6371000) * (180 / Math.PI),
      p.lon + ((dx * boxM) / 2 / (6371000 * Math.cos(toRad(p.lat)))) * (180 / Math.PI),
    ));
  }
  return best;
}

// Mirrors sightline.ts losToBurst.
async function los(obs, obsGround, target, burstAGL, stepM = 30) {
  const D = haversine(obs, target);
  const h0 = obsGround + EYE;
  const h1 = (await elev(target.lat, target.lon)) + burstAGL;
  const n = Math.max(8, Math.round(D / stepM));
  let minClear = Infinity, blocker = null, lift = 0;
  for (let i = 1; i < n; i++) {
    const d = (D * i) / n;
    if (d < 120 || D - d < 60) continue;
    const p = lerp(obs, target, i / n);
    const clear = h0 + ((h1 - h0) * d) / D - ((await elev(p.lat, p.lon)) + (d * (D - d)) / (2 * R_EFF));
    if (clear < minClear) { minClear = clear; blocker = d; }
    lift = Math.max(lift, (-clear * D) / d);
  }
  if (minClear === Infinity) return { distanceM: Math.round(D), marginM: burstAGL, blockerKm: null, requiredAGLM: burstAGL };
  return {
    distanceM: Math.round(D),
    marginM: Math.round(minClear),
    blockerKm: minClear > 0 ? null : Math.round(blocker / 100) / 10,
    requiredAGLM: Math.round(burstAGL + Math.max(0, lift)),
  };
}

async function horizon(obs, obsGround, azFrom = 235, azTo = 325, azStep = 1, maxKm = 25, stepM = 60) {
  const h0 = obsGround + EYE;
  const out = [];
  for (let az = azFrom; az <= azTo; az += azStep) {
    let best = -6;
    for (let d = 150; d <= maxKm * 1000; d += stepM) {
      const lat = obs.lat + ((d * Math.cos(toRad(az))) / 6371000) * (180 / Math.PI);
      const lon = obs.lon + ((d * Math.sin(toRad(az))) / (6371000 * Math.cos(toRad(obs.lat)))) * (180 / Math.PI);
      const ang = (Math.atan2((await elev(lat, lon)) - (d * d) / (2 * R_EFF) - h0, d) * 180) / Math.PI;
      if (ang > best) best = ang;
    }
    out.push({ az, deg: Math.round(best * 100) / 100 });
  }
  return out;
}

const out = { schema_version: 1, computed_at: new Date().toISOString(), dem: "USGS NED 10m via AWS terrain tiles (terrarium z13)", horizons: {}, viewpoints: [] };

for (const [id, v] of Object.entries(VENUES)) {
  const ground = await elev(v.lat, v.lon);
  out.horizons[id] = await horizon(v, ground);
  console.log(`horizon ${id}: peak ${Math.max(...out.horizons[id].map((h) => h.deg)).toFixed(1)}°`);
}

for (const vp of VIEWPOINTS) {
  const ground = await bestGroundNear(vp);
  const results = {};
  for (const [venueId, v] of Object.entries(VENUES)) {
    const [r90, r150] = [await los(vp, ground, v, BURSTS[0]), await los(vp, ground, v, BURSTS[1])];
    results[venueId] = {
      distanceM: r90.distanceM,
      margin90M: r90.marginM,
      margin150M: r150.marginM,
      blockerKm: r90.blockerKm,
      requiredAGLM: r90.requiredAGLM,
    };
  }
  const sensitive = [];
  for (const [venueId, v] of Object.entries(VENUES)) {
    const base = marginClass(results[venueId].margin90M);
    for (const [dn, de] of SENS_OFFSETS) {
      const o = {
        lat: vp.lat + (dn / 6371000) * (180 / Math.PI),
        lon: vp.lon + (de / (6371000 * Math.cos(toRad(vp.lat)))) * (180 / Math.PI),
      };
      const r = await los(o, await bestGroundNear(o), v, BURSTS[0]);
      if (marginClass(r.marginM) !== base) { sensitive.push(venueId); break; }
    }
  }
  out.viewpoints.push({ ...vp, groundM: Math.round(ground), results, sensitive });
  console.log(`viewpoint ${vp.id}: ` + Object.entries(results).map(([k, r]) => `${k} ${r.margin90M > 0 ? "+" : ""}${r.margin90M}m`).join(" · ")
    + (sensitive.length ? `  ⚠ flips within ±100 m: ${sensitive.join(", ")}` : ""));
}

writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
console.log(`wrote ${OUT} (${tiles.size} tiles fetched)`);
