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

## Active: Next.js migration (M1)
Branch `m1-nextjs-migration`. Spec: `planning/specs/2026-06-21-m1-nextjs-port-design.md`.
Parity port + real subfolder pages, native blog, embedded shop. Data pipeline + scoring untouched.
Cut Vercel over to `next build` and trim the daily workflow to commit `data/` only at the very end.
- [ ] **M1 — Next.js port** (see spec).
- [ ] Then: M2 real forecast (current/hourly), M3 accuracy layer (head-to-head + methodology page),
      M4 maps/cams, M5 multi-location, M6 station ground-truth.

## To do — site (pre-station, outstanding)
- [ ] **Recalibrate the 5-sweater scale for Boone's climate** — flagged wrong: 54°F scored only
      1/5 sweaters, too low. Boone's elevation/wind/humidity make 54°F feel colder than the
      same temp in a lower town; the scale should reflect local context.
- [ ] Head-to-head accuracy comparison (Ray's vs Dave's Sweater/Open-Meteo) on the homepage,
      like the manual Deep Gap analysis (DS 92/100 vs Ray's 67/100 on 2026-06-14).
- [ ] Logo: Dave's face in Ray's logo style (needs photo upload).
- [ ] Copy / sweater-terminology polish.
- [ ] Make scoring methodology visible/defensible on the site (claims = tracked data, not assertion).
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
