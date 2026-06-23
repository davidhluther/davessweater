# Dave's Sweater — Checklist

This file is the durable single source of truth for outstanding work. Read it at the
start of each session and keep it current — check items off, add new ones, and update it
in the same change that completes a task. Do not rely on chat memory; this file wins.

## Decisions made
- **Migrating presentation to Next.js** (owner's standard stack) and growing DS from a low-effort
  joke into a substantive, Ray's-Weather-class local weather site; the **Right/Wrong Ray accuracy
  tracker is the signature differentiator**. Python data pipeline + scoring stay as the data source.
  See `planning/specs/2026-06-21-m1-nextjs-port-design.md`.
- Start with ONE full weather station in Boone; expand later.
- Hardware: Ecowitt Wittboy (WS90) all-in-one array + GW2000 gateway (~$200). Chosen over
  Ambient Weather WS-2902 (pricier, more locked-in). WS90 uses a haptic rain sensor (no
  moving parts to freeze/clog).
- Pipeline v1: station → ecowitt.net → Ecowitt API → GitHub Actions pull → commit to repo.
  Cloud-only path; fits the existing stack.
- Orange Pi NOT in the v1 pipeline. Local-push (GW2000 → Pi collector) only buys
  cloud-outage resilience / sub-minute polling / full data ownership — none of which a
  one-station daily/hourly accuracy tracker needs, and it adds a real maintenance tax. Add
  the Pi later only if local resilience or sub-minute multi-station data is genuinely needed;
  it can be added without changing anything upstream.

## Done: Next.js migration (M1)
Migrated presentation to Next.js 16 (App Router); Python data pipeline + scoring unchanged.
Spec/plan: `planning/specs/2026-06-21-m1-nextjs-port-design.md`, `planning/plans/2026-06-21-m1-nextjs-port.md`.
- [x] **M1 — Next.js port** — parity + real subfolder routes, native blog (sanitized), embedded
      Fourthwall shop modal, sitemap/robots, GA + both GSC tags, Ray's-style white logo.
- [x] **Cutover** — Vercel builds with `next build` (`vercel.json` framework=nextjs, outputDirectory=.next);
      daily Actions commit `data/` only; `build_site.py`, `docs/`, `rebuild_on_screenshot.yml` retired.

## Active: M2 — modern redesign + accuracy homepage
Original, dynamic design (own brand; share only the teal/orange palette + the genre — **NOT a Ray's
clone**, for legal safety). Homepage leads with the joke *backed by data* — free services
(Open-Meteo/Apple) beat Ray's — from `scores.json`. Keep the iPhone screenshot; add a small live
current-conditions strip + a few-day mini-outlook. Apply the design system across all pages.
(The head-to-head was pulled forward from the old M3.)
- [ ] M2 — design system + accuracy homepage. **Spec approved:**
      `planning/specs/2026-06-21-m2-redesign-accuracy-homepage-design.md`. Locked direction:
      Style-A data-journalism on the bold "C" dark-teal/orange palette; dark hero + dark
      feature-bands on a light body; **mobile-first** (likeliest traffic); homepage = conversion
      **front door** leading with the data (free Open-Meteo/Apple beat paid Ray's); the daily
      iPhone screenshot **co-anchors the hero** ("the only weather service you need is already in
      your pocket"), labeled honestly real-Apple-vs-Open-Meteo-fallback; brand mark "Boone's #1
      weather ~~service~~ tracker" (eyebrow), "most mostly reliable" tagline by the logo; sharp,
      pointed voice (don't soften); Space Grotesk display + Inter; design system applied across all
      pages. Stats/trend/head-to-head refresh daily via existing CI → Vercel (no manual step); the
      *real* Apple screenshot still depends on a manual iPhone-Shortcut upload (auto fallback covers
      other days) — true daily automation of it is a separate, post-M2 pipeline task. No
      pipeline/scoring changes in M2.
      **BUILT & verified on branch `m2-redesign-spec`** (plan:
      `planning/plans/2026-06-21-m2-redesign-accuracy-homepage.md`): lib fully unit-tested
      (heroStats/trend/headToHead/screenshot), homepage assembled + all pages restyled, mobile-first
      (header menu, tables→cards), `npm test`/lint/`build` green, visually verified mobile + desktop.
      Final code review fixes applied — incl. **correcting a false "dead last 29×" claim**: `totals.wrong`
      is the count of days a source was *graded "Wrong" (scored < 60)*, not a per-day ranking, so the
      homepage now reads "the free services were never once graded Wrong; Ray's earned that grade 29
      times" and the `/right-wrong-ray` W/L/M legend was corrected to grade bands. **Pending: merge to
      `main` + confirm Vercel preview.**
- [ ] **Post-M2 follow-up — automate the *real* Apple Weather screenshot.** Today the hero's prominent
      screenshot is daily-auto only for the Open-Meteo fallback; the real Apple shot needs a manual
      iPhone-Shortcut upload (`upload_screenshot.yml`). Automate the Shortcut and add a reliable source
      marker (sidecar) so `IphoneShot` can drop the file-size heuristic. (Owner may pick this up in a
      separate session — the Shortcut is the screenshot source.)
- [ ] Then: M4 radar/maps + Woolcam + photo-of-the-day, M5 multi-location, M6 Ecowitt station ground-truth.

## To do — site (pre-station, outstanding)
- [ ] **Recalibrate the 5-sweater scale for Boone's climate** — flagged wrong: 54°F scored only
      1/5 sweaters, too low. Boone's elevation/wind/humidity make 54°F feel colder than the
      same temp in a lower town; the scale should reflect local context.
- [ ] Head-to-head accuracy comparison (Ray's vs Dave's Sweater/Open-Meteo) on the homepage,
      like the manual Deep Gap analysis (DS 92/100 vs Ray's 67/100 on 2026-06-14).
      → folded into M2 spec (homepage §4, "Yesterday's head-to-head").
- [x] Logo: Ray's-style white wordmark + white circle behind Dave's face (AI-recolored → `public/assets/logo-white.png`).
- [ ] Copy / sweater-terminology polish.
- [ ] Make scoring methodology visible/defensible on the site (claims = tracked data, not assertion).
- [ ] Update `README.md` — still describes the old GitHub-Pages / `build_site.py` setup; rewrite for Next.js + Vercel.
- [ ] Fourthwall: contact support about the Storefront API 403; if fixed, switch back from the
      Merchant Center RSS feed for richer product data.

## To do — content / distribution
- [ ] Instagram automation (Graph API posting).
- [ ] Weekly summary workflow + graphic.
- [ ] "Woolcam": JideTech 4K 8MP PoE bullet camera (built-in RTMP → YouTube). Not set up.

## To do — weather station hardware
- [ ] Order Wittboy WS90 + GW2000.
- [ ] Order mast/pole mount if not roof-mounting (~$20–50).
- [ ] Site the station: open exposure for wind; shade/airflow for temp; roof preferred.

## To do — weather station software
- [ ] Get Ecowitt application/API key.
- [ ] Write a GitHub Actions job to pull the Ecowitt API and commit the latest reading.
- [ ] Define the data schema / `latest.json` format.
- [ ] Wire observations into the forecast-vs-observed scoring (station becomes the ground-truth
      "actuals" source).

## Open questions
- Is roof/house exposure adequate for wind siting?
- Eventual expansion: distinct named microclimates (Boone / Blowing Rock / Deep Gap) vs. a
  tighter cluster?

## Orange Pi cutover (separate from weather; tracked here because it's in flight)
> Network, VPN, SSH, and host specifics are intentionally **not** stored in this public repo.
> Full details live in a private reference (`orange-pi-handoff.md`, kept local / out of version
> control). The task list below is the only thing tracked here.
- [ ] Move the Pi to the router and connect it over Ethernet.
- [ ] Set a DHCP reservation pinning its address (value in the private reference).
- [ ] **Before cutover:** update the WireGuard `wg0.conf` PostUp/PostDown NAT masquerade rule to
      the new wired interface (otherwise VPN clients lose routing). Details in the private reference.
- [ ] Disable Wi-Fi once stable on wired (one interface, one default route).
- [ ] Confirm WireGuard + SSH still resolve after cutover.
