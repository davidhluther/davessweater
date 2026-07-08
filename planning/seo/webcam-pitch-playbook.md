# Dave's Sweater webcam playbook — scoping, siting, hardware, cost, and the pitch

Field-usable plan for pursuing the webcam-as-backlink-and-partnership angle. Grounded in the 2026-07-07
cost/backlink research (`planning/seo/2026-07-07-rays-competitive-research.md`). This is a FUTURE-milestone
play (sequence after widget + locations) — but here's everything you'd need when you run it.

**Reality anchor:** the camera is the cheap part. The scarce assets are (1) a good VIEW with power +
internet, and (2) a business RELATIONSHIP. Ray's whole model is that sponsors supply #1 and #2 and pay him
on top. Our edge is to give the sponsor a better deal on both.

---

## 0. What you need before you can pitch anyone (build the pilot first)

You can't sell a cam you've never built. Minimum viable proof:
1. **One working pilot cam** — live, on a public page, submitted to Windy/Ventusky, earning its first links.
   (Candidate site: a friendly local business, or your own vantage with privacy handled — mountains-only
   framing, nothing that shows the house/address, per the standing privacy rule.)
2. **The snapshot pipeline** — camera → snapshot JPG every 30–60s → public URL (`davessweater.com/cam/
   <name>/latest.jpg`) → hosted ~free. This one URL is what every directory and every sponsor embed uses.
3. **A branded cam page template** on the site: the live view + current conditions + the accuracy tie-in
   ("what's the sky doing vs. what was forecast") + a sponsor slot.
4. **This playbook + a one-page leave-behind** for the pitch (offer to make the leave-behind an Artifact).

Once the pilot exists, every pitch becomes "here's ours, live, already ranking — want one for your place?"

---

## 1. Scoping checklist — what to confirm FROM the business

Walk in with this. If a spot fails the ⚠️ items, it's not viable; the rest are quality signals.

**The view**
- [ ] What does it see? (signature peak, valley, Main Street, ski slope, downtown). Is it *weather-relevant*
      and recognizable — sky visible, a landmark in frame? A boring wall view isn't worth a cam.
- [ ] Is the sightline unobstructed (no trees/signs/wires/AC units in the foreground)?
- [ ] ⚠️ Night: is the scene lit enough to be worth showing after dark, or is it daytime-only? (Windy wants
      a cam usable day AND night; a black rectangle at night gets rejected/looks dead.)

**Power + connectivity (⚠️ deal-breakers if missing)**
- [ ] ⚠️ Power: is there an accessible outlet near the mount, or can PoE be run from inside? (PoE = one cable
      does power + data — strongly preferred.)
- [ ] ⚠️ Internet: do they have Wi-Fi/wired you can put a device on? Willing to allow it (ideally on a
      guest/segregated network)? Any data cap? (Snapshot cam sips ~9 GB/mo; live video burns ~800 GB–1 TB.)
- [ ] Bandwidth adequate for what you're offering (stills = trivial; live = needs real upload headroom).

**Access + ownership**
- [ ] ⚠️ Does your contact actually control the building/roof/wall? (Landlord? HOA? Property manager?)
- [ ] Can the mount be physically reached for install + occasional maintenance (lens clean, reboot)? Who owns
      upkeep — you, or them?
- [ ] Are they staying put? (Don't build at a business about to relocate/close.)

**Consent + privacy (goodwill AND legal)**
- [ ] ⚠️ Are they OK with this view being public 24/7?
- [ ] ⚠️ Does the frame capture anything sensitive — into a neighbor's yard/windows, a lot with readable
      plates, people up close? Frame it to a public scene / horizon. When in doubt, tilt up toward the sky.

**Fit for the bit**
- [ ] Is this a business/organization that *wants* to be associated with the scrappy, data-honest upstart?
      (Independent shops, resorts proud of their view, community-minded orgs > brands that just want a logo.)

---

## 2. Siting checklist — the technical/physical install

- [ ] **Aim:** elevated, looking at the horizon or slightly down; a recognizable landmark + sky in frame.
- [ ] **Sun:** avoid pointing straight east/west into sunrise/sunset (lens flare, sensor bloom). North-ish
      or into-a-scene framing is safest. Test the frame at several times of day before finalizing.
- [ ] **Weatherproofing:** IP66/67 body + a sunshade/hood; angle to shed rain. **A heater/defroster is the
      difference-maker in the mountains** — fog/frost/ice on the dome is the #1 reason local cams go dark.
- [ ] **Glass vs open air:** exterior mount beats shooting through a window (glass = reflections/glare, and
      IR bounces back at night — if you must shoot through glass, disable IR).
- [ ] **Cable:** PoE up to ~100 m (330 ft) on outdoor-rated/shielded Cat5e/6; add a drip loop + weatherproof
      RJ45 boot at the camera.
- [ ] **Surge/ground:** mountains = lightning. Add a PoE surge protector, especially on a roof or pole.
- [ ] **Mount rigidity:** wind shake ruins the image — solid bracket, not a flimsy arm.
- [ ] **Network:** DHCP reservation or static IP; segregated/guest network if possible; confirm your fetcher
      can reach the snapshot/RTSP endpoint.
- [ ] **Monitoring:** alert when the cam stops updating (Ray literally has dead cam URLs — uptime is an edge).

---

## 3. Make it visibly BETTER than his (the quality menu)

Ray's cams are a mix (~23 stills, ~13 live off one Wowza box); many local weather cams are low-res, slow,
and dead at night. Ways to be obviously better:

| Lever | Cheap/his baseline | Our upgrade |
|---|---|---|
| Resolution | ~1080p stills | 4K sensor (Reolink RLC-810A 8MP, ~$90; RLC-1212A 12MP) — crisper stills |
| Framing | fixed wide shot | optical-zoom/PTZ hero shot of a signature peak (RLC-823A 16×, ~$350) |
| Refresh | slow stills | snapshot every 30–60s (or true LL-HLS live) — feels alive |
| Night | black rectangle | low-light/ColorX sensor or a lit scene → 24/7 useful |
| Reliability | fogs/ices over | heater + sunshade + uptime alerting → up when his is down |
| Content | static view | auto **daily timelapse** (sunrise→sunset, storm roll-in) — shareable, he doesn't do it |
| The bit | just a view | overlay current temp + a "forecast vs. actual" accuracy badge → ties to the scoreboard |
| Coverage | one angle | multi-angle from one site where it earns it (like his 4-view LifeStore cam) |

The two cheapest upgrades with the biggest visible payoff: **higher refresh + a daily timelapse** (both
basically free off the snapshot archive) and **a heater** (so you're the cam that survives winter).

---

## 4. Cost — scoped for several spots

| Item | One-time | Monthly |
|---|---|---|
| Snapshot cam per site (Reolink RLC-810A ~$90 + PoE/mount ~$40 + surge/heater ~$30–50) | **~$130–180** | ~$0–5 hosting (all sites combined) |
| Flagship "hero" PTZ cam (RLC-823A 16× ~$350 + mount ~$50) | **~$400** | — |
| Live streaming (only if you want live, not just stills) — one MediaMTX VPS serves *several* cams | — | **~$6–12 total** |
| Cellular uplink (only for an off-grid site with no host internet) | — | ~$4–20 (snapshot) / ~$30–70 (live) |

**Scoping 3–4 spots:** budget ~$130–180 each for snapshot cams + one ~$400 hero cam for your flagship view →
**~$500–900 one-time + ~$12/mo** infra if you go live at all. Compare: each sponsor pays *Ray* ~$1,200–2,400
**per year**. Your whole network costs less than one of his annual sponsorships. The real cost is your time
(install + pipeline), not dollars.

---

## 5. The pitch — beating him on more than price

Ray's moat is his audience ("200–300k monthly uniques"). Don't fight that head-on; reframe what the sponsor
is actually buying. His cam lives on *his* site — the sponsor is **renting a slot on Ray's property and
feeding Ray's SEO.** Flip every axis:

**1. Give them an ASSET, not a rental.** Our cam can be **embedded on the sponsor's OWN website** (a widget
they own) — so the live view drives traffic and dwell time to *their* site, and we cross-link them. With
Ray, the traffic and link equity flow to Ray. With us, the sponsor keeps them. "His cam builds his site;
ours builds yours."

**2. They keep the SEO.** Point the backlinks/embeds at the sponsor's domain; we co-link. They stop donating
link equity to a competitor-of-their-attention and start banking it.

**3. Better product** (§3): sharpest cam in town, a zoom hero shot, a daily timelapse to share on their
socials, night-usable, and it doesn't die when it snows. "When Ray's cam is a frozen gray square in
January, yours is live."

**4. They become part of a story, not a logo in a list of 53.** Dave's Sweater is the accountability brand —
the site that checks Ray's homework. A cam page pairs their view with "what's actually happening vs. what
was forecast." That's shareable/press-friendly; his cam is a utility. Position it as a **limited local
partnership** ("one of a handful of signature High Country views"), co-branded, not an ad line-item.

**5. Reach beyond either of us.** Listing on **Windy Webcams** puts the view in front of an audience far
larger than Ray's, plus it seeds the travel-site re-embed cascade. So "he has the viewers" is answered
three ways: the cam is how you *build* an audience; the sponsor's own embed generates discovery independent
of both sites; and the directories out-reach him.

**6. Free / cheap + no lock-in.** Ray charges ~$1–2k/yr and reserves the right to switch you off "at his
sole discretion" (his own ToU). Ours: free or nominal, you own the embed, no revocation-at-whim.

**Honesty guardrail (bulletproof in daylight applies to sales too):** don't claim we out-draw Ray — we
don't, yet. The pitch is "your own asset + a superior cam + you're part of the story + directory reach + you
keep the SEO," not "more eyeballs than Ray." Overpromising audience is the one way this pitch backfires.

**One-line version:** *"Ray rents you a slot on his site and keeps the traffic. We give you a sharper camera,
put the live view on your own website, help your search ranking instead of his, and make your view part of
the story about who's actually right. Costs you less, and you own it."*

---

## 6. Sequence (where this sits)

1. Widget + multi-location first (per the standing attack order — cheaper leverage, and the cam page reuses
   the location work).
2. Build the **pilot cam** (§0) — proof + first directory links.
3. Scope 2–3 signature-view partners with §1; install with §2; upgrade with §3.
4. Only after there's a small network + the widget is placed → approach the higher-stakes targets
   (ExploreBoone/TDA), where a cam + widget bundle is the offer and diplomacy matters (his likely
   relationships there).
