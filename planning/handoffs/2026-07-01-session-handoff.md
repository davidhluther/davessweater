# Session handoff — 2026-07-01

Big session. The promotion-readiness register is now **engineering-complete**, the Apple column
is honest, the pipeline is hardened, and the SEO/perf/a11y pass is underway. **12 PRs merged
today (#77–#88); no open PRs; `main` is green and clean.**

Authoritative state lives in **`CHECKLIST.md`** (durable to-do) and the memory files. This handoff
is orientation, not the source of truth — trust the checklist.

---

## Immediate next task (HELD)

The **accessibility bundle**, held at the owner's request to resurface **after they reload Claude
Code with Fable**. It's fully spec'd in `CHECKLIST.md` → section **"SEO / performance / accessibility"**
with every `file:line` and fix. When the owner says go ("do the a11y bundle"), implement it as one PR:
- orange text `#f97316`→`--orange-600 #c2410c`; add a darker `--green-700 (~#0f7a58)` for green text
- skip-to-content link + `id="main"`; promote missing `h1` on /right-wrong-ray, /shop, /videos, /blog
- shared visible focus ring; fix RayFaces/sweater `alt` spam; aria-hidden decorative emoji
- Lighthouse a11y is 92 today; this should reach ~100. **SEO already = 100; Best Practices 96.**

Do NOT start it unprompted — the owner is switching models first.

---

## What shipped today (all merged + live)

**Promotion-readiness register — engineering-complete (only R10 = counsel remains):**
- **#79** R11 (Met.no/OpenWeather capture-day **low** was a partial-bucket min biased warm 5–17°F →
  `compare.py:_fix_bucket_low` recovers it from the prior-morning day-ahead forecast; backfilled) + R7
  (backfilled 2026-05-22; deleted 2 ghost comparisons; skip-empty guard).
- **#80** R6 + M3 #3 — new `/right-wrong-ray` **"the rest of the field"** board (`OtherSourcesBoard` +
  `otherSourcesRows`) surfaces all 7 free forecasters, ranked past a shared `MIN_SCORED_DAYS=14` gate
  (`src/lib/gating.ts`), provisional below it. R6 closed by **surfacing consistently, not hiding**
  (owner's "I want more sources"); `types.ts` union widened to string-keyed; `/methodology` gained the
  R11 "Reading the overnight low" disclosure.
- **#81** R3 (capture-health guard) + R9 (concurrency group + reset preamble) + R12 (snow-scoring replay test).
- **#78** hero forecaster **logo strip** (`ForecasterLogos` + `FORECASTERS`); **#77** methodology copy rewrite.

**Apple column made honest (owner chose to ship):**
- **#82** 26 real Apple days rebased onto current scoring; **#83** +6 more (06-25→06-30) after finding the
  Shortcut had regressed to screenshot-only again. **32 real Apple days now.** `compare.py` records a
  `source` field (real vs fallback). Cumulative **Apple = 88.28** (32 real @ **77.1** + 85 Open-Meteo
  fallback @ 92.5). Open-Meteo **91.74**, Ray's **71.01** — unchanged throughout.

**Reliability — full set (the Ray-deflation class is now covered):**
- Point-in-time guard (#81) → apple-fallback note (#83) → **rolling drift** (#85, catches a reliable field
  gone dark 7+ days) → **auto-backfill sweep** (#86, re-scores an archive-lagged day once actuals land).

**SEO / perf / a11y (#87, #88):**
- Audited (multi-agent + Lighthouse prod/mobile). **SEO 100.** Perf was **70 / LCP 19.7s** — cause: the
  hero iPhone screenshot was a **2.8MB** PNG shown at 150px. `prepare_public.mjs` now resizes it with
  `sharp` to an **18KB WebP**; `IphoneShot` loads eager/high-priority. **Prod: LCP 19.7→5.0s, perf 70→78.**

---

## Backlog / pending (see CHECKLIST for detail)

- **a11y bundle** — queued (above).
- **Residual perf** (optional, diminishing returns): LCP 5.0s / FCP 2.7s under Lighthouse's mobile throttle
  → font loading (display swap/preload) + render-blocking. Real users already ~1–2s.
- **Ecowitt ground-truth pipeline** — **owner-chosen hardware: Ecowitt Wittboy WS90 array + GW2000 gateway
  (~$200)** (haptic rain sensor, no freeze/clog; beat Ambient WS-2902). v1 = cloud-only (station →
  ecowitt.net → Ecowitt API → a GitHub Action pulls readings → commits as authoritative actuals, replacing
  the self-judging Open-Meteo archive; the last real credibility gap). **BUILD IS BLOCKED on the physical
  station being set up** — owner will do hardware; build the software when it's live.
- **iPhone Shortcut fix (owner)** — the Shortcut uploads a screenshot PNG but no scoreable JSON, so real
  Apple silently regresses to fallback until re-transcribed. **Priority field = SUSTAINED wind speed** (Get
  Current Weather → Wind Speed): the screenshots only show gusts, so real Apple is scored on `[0,gust]` and
  sits ~77; a real sustained number lifts it toward ~90. Steps in `planning/apple-weather-shortcut-setup.md`.
  The health guard now flags this regression (non-fatal note) so it isn't silent.
- **R10** — trademark / scrape-republish counsel review (owner, non-engineering).
- Content/distribution (Instagram automation, weekly summary graphic, "Woolcam") + Orange Pi cutover — backlog.

---

## Key decisions & gotchas (don't relitigate)

- **R1 Apple-fallback-as-Apple = owner-ACCEPTED risk.** The 85 no-data days stay Open-Meteo-scored-as-Apple
  with **no site disclosure, no gate, no relabel, no `bestFree` change**. Shipping the real days only adds
  honesty. **Do NOT gate/relabel Apple** in future sessions. (See memory `davessweater-apple-real-data`.)
- **DECLINED — fabricating historical Apple wind.** The owner asked to write invented sustained-wind numbers
  into the historical days (not present in the screenshots) and **not document it**. Declined: that's data
  fabrication on a public site that grades a named competitor and stakes everything on defensibility (the
  owner himself earlier rejected gust-based wind as fabrication). Honest paths offered instead: fix the
  Shortcut, provide detail-view screenshots (which show real sustained wind), or a *disclosed* model. Real
  Apple stays on the honest `[0,gust]` interval. Hold this line.
- **Scoring model** = fixed `/100`, implied-zero precip, bucket-low recovery for metno/owm (all in `compare.py`/
  `scoring.py`, documented in `CLAUDE.md`). `scripts/rescore_history.py` re-derives from stored predictions.
- **GHA workflow-edit security hook** is coarse/flaky — it blocks `.github/workflows/*.yml` edits even when
  injection-free; **retry usually passes**. Keep `${{ github.event.* }}` in `env:`, never in `run:`.
- **Vercel previews are auth-gated** → Lighthouse/external tools hit the login page. Verify perf on
  **production** after merge, not on the preview URL.
- **Daily-bot race:** merging a data PR races the ~14:00–14:30 UTC daily Actions. Reconcile by merging
  `origin/main` into the branch and **deterministically regenerating** (backfill/rescore), not hand-merging JSON.
- **AI writing rules** (memory `ai-writing-style-rules`) apply to ALL copy: em-dashes ≤1/200 words, sentence-
  case headings, straight quotes, no puffery/AI-tell vocab.
- Public repo — no personal/network/political details in commits (private context stays local).
