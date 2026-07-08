# Traffic + winter road-condition forecast — design

**Date:** 2026-07-08
**Status:** DRAFT for owner review. Scope locked by owner (hybrid product / Boone chokepoints first /
buy-now-build-later data). Do NOT implement until owner approves this design; then it becomes an
implementation plan.
**Related:** `CHECKLIST.md` → "Traffic forecast" section (research banked there);
`planning/seo/webcam-pitch-playbook.md` (cameras do double duty); `scripts/capture_*.py` +
`data/actuals/{date}.json` (the pattern this extends).

## 1. The product (locked)

A **hybrid**: a scored, forward-looking **forecast** (the on-brand differentiator — "we grade forecasts;
now traffic and roads too") plus a **live-conditions** hook (current incidents/cameras/road status) that
brings people back daily. Winter **road conditions** are a first-class pillar, not an add-on. Scope starts
at **Boone chokepoints**, expands once proven.

**Competitive whitespace (confirmed):** nobody — local or national — publishes a *scored, event- and
weather-driven local* traffic/road forecast. Google/TomTom/INRIX do generic typical-day prediction;
DriveNC/511 and Ray do current-state only (**Ray has no road-conditions product at all**). One incumbent to
respect, not attack: **WataugaOnline** (beloved ad-hoc "allow extra time" alerts) — we're the systematic,
scored complement. The scoring layer is the moat.

## 2. Phasing — lead with the road-condition forecast (the key recommendation)

The research reordered the smart build. Each phase ships standalone value; each later phase reuses the
earlier plumbing.

- **v1 — Winter road-condition forecast ("will the roads be bad tomorrow AM?").** RECOMMENDED FIRST.
  Reuses the snow/ice/temp data the pipeline **already forecasts** — *no cameras, no traffic API needed* —
  and fills a gap every local channel leaves open (they all report the present; nobody forecasts road
  surface). Gradable against NCDOT's Snow & Ice layer as the actual. Near-zero marginal cost, purely
  additive, and the fastest genuinely-novel win.
- **v2 — Traffic forecast.** Predict congestion/travel-time per corridor for the day/window ahead, driven
  by the differentiated signal nobody else uses: **App State schedule + festival/leaf/ski calendar +
  weather**. Graded against a live-traffic API now (camera-CV later). Beats Google specifically on
  event/weather days because Google's generic curve doesn't know about the game or the snow.
- **v3 — Our own camera-CV ground truth.** Instrument the chokepoints with edge vehicle-recognition to
  produce an independent congestion "actual" (the Ecowitt arc — stop grading against a competitor's API).
  Doubles as the backlink/webcam play.

## 3. Data sources — have-it-free vs. must-build

The government stack is free and covers the High Country; live congestion is the only paid/limited piece.
**Two free keys to request first: a DriveNC developer key and an NPS API key.**

| Data | Status | Source & cost | Rural reality |
|---|---|---|---|
| Incidents / crashes / closures | ✅ Free API (free key) | DriveNC v2 `/api/v2/get/event` (JSON/XML, 10 calls/60s) | Statewide incl. our roads; density low off-season, spikes in storms |
| Snow & ice road conditions | ✅ Free API (free key) | DriveNC `/api/v2/get/snowandice` | Human-entered categories incl. High Country — **the v1 actual** |
| Work zones | ✅ Free, NO key | DriveNC `/api/wzdx` (GeoJSON) | US-321/421/221 present, intermittent in HC |
| Historical volumes (AADT) | ✅ Free, fully open + downloadable | NCDOT AADT ArcGIS FeatureServer / TCDS (2002–2024) | **Verified: 186 segments in Watauga, up to 44k AADT** — dense. Baselines + which-roads-matter weighting |
| Blue Ridge Parkway closures | ✅ Free API (free key) | NPS `developer.nps.gov/api/v1/alerts?parkCode=blri` | Authoritative; BRP closes all winter — high-value |
| NWS winter/road-impact | ✅ Free API | api.weather.gov (NWS Blacksburg RNK) | Zone-level NC Mountains |
| **App State football schedule** (top demand signal) | ✅ Free ICS | SIDEARM `calendar.ashx/calendar.ics?sport_id={football}` (auto-updating) | ~6 home games/yr, mostly Sat, occasional Thu |
| Festival / leaf / ski / tree-season dates | ✅ Free (fixed-date rules) | Pre-populate rules + light annual scrape | Verify yearly |
| **Live congestion / travel time** | ⚠️ Paid / free-tier-limited | **TomTom 2,500/day free** (commercial OK) · HERE 30k/mo · Google Routes 5k/mo then $10/1k | **Google best rural**; all thin on NC-105/194; none on the Parkway |
| Waze feed | ❌ Not available | Waze-for-Cities = public-sector only | — |
| RWIS pavement sensors near Boone | ❌ None public | — | Use Snow & Ice layer + cams |
| Plow GPS | ❌ NC doesn't publish | — | No feed |
| DOT cameras in Boone | ⚠️ ~None DOT-owned in HC | Ray's cams are the de-facto road cams | Reinforces the v3 own-camera path |

**Live-congestion cost math (v2):** ~5 corridors × 4 polls/hr × ~18 hr/day × 30 = ~10,800 calls/mo — inside
**TomTom's free 2,500/day (75k/mo)**. So v2's live actuals are **~$0/mo within free tier** (Google as a
paid fallback only where TomTom coverage is thin).

## 4. Grading model (maps onto `scripts/scoring.py`)

Same philosophy as the weather tracker — predict, record the actual, score transparently, per condition:

- **Travel-time / speed** → **MAE per corridor** (within X min = full, penalty per min beyond — mirrors the
  temp tolerance).
- **Categorical congestion** (Clear / Busy / Jammed) → hit-rate / confusion-matrix (like precip-type: exact
  full, adjacent partial).
- **Binary "will it jam?"** → **Brier score** + **Brier Skill Score vs. a naive typical-day baseline** — the
  literal "chance of rain" metric, perfectly in voice, and the same "we beat the baseline" story the site
  already tells.
- **Road-condition (v1)** → a verdict (Clear / Slushy / Icy / Hazardous) graded against DriveNC Snow & Ice.
- **Grade OTHERS too:** score **Google's predicted ETA** alongside ours. Score **per condition** (game day
  / leaf Saturday / ordinary Tuesday), never one blended number — more honest and more interesting.
- **Actuals:** traffic-API live speed (v2) → our camera-CV congestion reading (v3). Same self-judging caveat
  as weather (softer to grade against a competitor's API), resolved by v3 — disclosed on `/methodology`.

## 5. Cameras (v3) — placement, count, cost

**Corridors (Boone chokepoints, priority order):** ① US-321/US-421 "the bypass" · ② King Street (downtown /
App State) · ③ US-321 → Blowing Rock (leaf/tourist) · ④ NC-105 / US-321 split (ski/Linville approach) ·
⑤ US-421 east (Deep Gap commuter). NC-105/US-321 (the Ray's-Wendy's intersection) is the natural first
sensor site.

**Count:** start with the top **2–3** (bypass, King St, 105/321), expand to ~5. Siting constraints are
identical to the webcam playbook (view + power + internet at a host business), so each traffic sensor is
also a backlink cam.

**Per-site cost (own camera + edge CV):** Reolink RLC-810A ~$90 + PoE/mount ~$40 + **Raspberry Pi 5 + Hailo
AI HAT+ ~$150** = **~$280/site**, **~$0/mo** compute. Reusing an existing snapshot cam drops it to ~$150
(just the Pi+Hailo). **3 sites ≈ $560–840 one-time.**

## 6. Vehicle recognition (v3) — approach

- **Edge, not cloud.** Pi 5 + Hailo-8L (13 TOPS) runs YOLOv8 + tracking locally at ~$0/mo. Cloud vision
  APIs bill ~$43–194/cam/mo forever and do worse; rented GPUs are ~$200–430/mo. Skip both.
- **Target CONGESTION LEVEL** (free-flow / heavy / stopped, ~94%+), **not exact counts** (85–95% and fragile
  at night/snow). It's also the honest, defensible metric for the bit — headline the level, footnote any
  count. One cam = one segment sample; scope the claim per instrumented segment.
- **Turnkey stack, ~nothing bespoke:** Frigate (ingest + car detection, native Hailo support) → Roboflow
  `supervision` + ByteTrack (track/count) → a density rule → congestion bucket → written as
  `data/actuals/…` the same way `capture_*.py` writes weather actuals.

## 7. Full phased cost

| Phase | Hardware (one-time) | Ongoing | Notes |
|---|---|---|---|
| **v1 road-condition forecast** | $0 | **~$0/mo** | Reuses existing snow/ice pipeline + free DriveNC/NPS/NWS keys. Dev time only. |
| **v2 traffic forecast** | $0 | **~$0/mo** | Live actuals within TomTom free tier; AADT + App State ICS + calendar all free. Dev time only. |
| **v3 camera-CV ground truth** | **~$560–840** (3 sites) | **~$0/mo** | Optional, later; doubles as backlink cams. |

The entire product is **near-zero marginal cost** through v2; v3 is a few hundred dollars one-time. The real
investment is engineering time.

## 8. Privacy & honesty guardrails

- **Aggregate only** from cameras — congestion level / counts, never plates or faces. State it on-page.
- **Scope every claim** to the instrumented segment (one lens ≠ "Boone traffic"), same as the weather
  tracker scopes to verified actuals.
- **Disclose the actuals source** and its self-judging softness (traffic API now → own cameras later), the
  same way `/methodology` handles the Open-Meteo-archive caveat.
- **Respect WataugaOnline** in any public framing.

## 9. How it slots into the repo

- New capture scripts parallel to `scripts/capture_*.py`: `capture_road_conditions.py` (DriveNC snow&ice +
  NWS + NPS), `capture_traffic.py` (TomTom live + incidents), later `capture_traffic_cam.py` (edge CV
  posts congestion readings). All write JSON under `data/` mirroring `actuals/` + `comparisons/`.
- A `forecast_traffic.py` / `forecast_roads.py` producing the daily predictions; a scoring extension reusing
  `scripts/scoring.py` patterns (MAE + Brier).
- New Next.js routes (e.g. `/traffic`, `/roads`) + a traffic "Right/Wrong" scoreboard mirroring
  `/right-wrong-ray`. Live-conditions island reusing the existing client-island pattern.
- Demand-signal ingest: subscribe the App State football ICS; encode the fixed festival/leaf/ski calendar.

## 10. Open questions for owner

1. **Confirm v1-first phasing** (road-condition forecast before traffic-volume forecast). Recommended.
2. **v1 scope:** road-condition forecast as its own `/roads` product, or fold into the existing weather
   pages first and split out later?
3. **How aggressive on v3 cameras** — build 2–3 now (they double as backlink cams, so arguably yes), or
   stay data-only through v2 and revisit?
4. **Live-traffic vendor:** start on TomTom free tier (recommended) vs. Google (better rural, paid past 5k)?
5. **Geographic expansion trigger:** what proof from the Boone pilot greenlights the ski-town / Ashe /
   arteries expansion you're open to?
