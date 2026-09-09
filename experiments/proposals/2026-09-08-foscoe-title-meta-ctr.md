---
name: foscoe-title-meta-ctr
hypothesis: >
  /weather/foscoe earns 535 town-intent impressions in 28 days and zero clicks; a title that
  names what the page actually delivers (today + 5-day) and a description that fits inside
  Google's ~155-character snippet will produce a non-zero click-through on those queries.
metric: CTR of https://davessweater.com/weather/foscoe on queries containing "foscoe"
instrument: Search Console query_search_analytics (page filter + query dimension), 0 units, $0
threshold: >
  WIN: >= 1.0% CTR on foscoe-intent queries over the 28-day window (>= ~5 clicks at comparable
  impression volume). NO EFFECT: still 0 clicks, or CTR < 1.0%. SAFETY / REVERT: average position
  on foscoe-intent queries degrades by more than 1.0 place vs baseline, or foscoe-intent
  impressions fall below 300 for the window.
baseline_window: 2026-08-10 .. 2026-09-06 (28 days, measured 2026-09-08; GSC lags ~2 days)
baseline:
  foscoe_intent_impressions: 535
  foscoe_intent_clicks: 0
  foscoe_intent_ctr: 0.00%
  foscoe_intent_avg_position: 10.3
  page_total_impressions: 957
  page_total_clicks: 1
  note: >
    The 535 figure is the sum of the five foscoe-named queries — "foscoe nc weather" 172,
    "weather foscoe" 162, "foscoe weather" 139, "weather foscoe nc" 37, "weather in foscoe nc" 25.
    The remaining ~420 impressions are generic head terms ("weather" 165, "weather tomorrow" 152)
    where a site this size at position 10 will not win clicks and which this experiment ignores.
measurement_window_days: 28
change: >
  src/app/weather/[slug]/page.tsx, generateMetadata only. Add a narrow per-slug override that
  applies to slug === "foscoe" and to no other town, so the other 16 town pages stay untouched
  as the control:
    title       "Foscoe, NC weather: Multi-source forecast, graded"  (49 chars)
             -> "Foscoe NC Weather: Today, 5-Day Forecast & Accuracy Grades"  (58 chars)
    description 195 chars, truncated mid-clause in the SERP at ~155
             -> "Today's Foscoe, NC forecast and the 5-day outlook, blended from every source we
                track and graded daily against Foscoe's own actual readings."  (140 chars)
  No other file, no route change, no data change, no deploy-config change.
revert_cmd: git revert <sha of the applying commit>   # recorded exactly at apply time, step 4
cost_usd: 0
ahrefs_units: 0
approved: false
risk: >
  Reversible in one command; the change is a metadata string in one prerendered page. The real
  risk is a false read, not damage — see the red-team below.
---

## Why this page

`/weather/foscoe` carries 957 of the site's ~1,900 28-day impressions — more than the next five
town pages combined — and converted 1 of them. Every foscoe-named query sits at average position
10.1–10.7 with 0.00% CTR. Whatever is true of the town template's snippet is most legible here,
and testing here isolates the question to a single page.

## Why title + description together

Two concrete defects, both fixable in the same string:

1. **The description is 195 characters.** Google renders roughly 155, so the live snippet is cut
   mid-clause and the sentence that carries the differentiator ("Its own data at its own
   coordinates, not a stamped regional copy") never reaches the reader. This is a defect
   independent of position — it is wrong for every impression at every rank.
2. **The title describes the method, not the deliverable.** "Multi-source forecast, graded" is
   what the site *is*; a reader typing "weather foscoe nc" wants to know it will show them today
   and the next five days. The proposed title keeps the grading differentiator and puts the
   deliverable in front of it.

## Red-team — what would have to be true for this to be wrong

**The strongest case against:** 0.00% CTR at average position 10.3 is close to what position
alone predicts. Position ~10 is the bottom of page one; a large share of those impressions are
never scrolled into view. If position is the binding constraint, no title wins the click and the
experiment returns "no effect" while the snippet change was nonetheless correct. **This is why
the title is not the whole change** — the truncation defect stands on its own, and why the
pre-registered read of "no effect" is *not* evidence that the old snippet was better.

**Steel-man of leaving it alone:** the repo has twice decided against churning town-page metadata
during the ramp (CHECKLIST, 2026-08-31: "title/description churn across 17 pages during the ramp
is a real risk"). That decision is respected here and is the reason the change is scoped to one
slug: 16 pages remain untouched controls, and the ramp risk the CHECKLIST names does not apply to
a single page.

**Confound to declare now:** fall traffic is ramping, so absolute impressions will move for
reasons unrelated to this change. The metric is CTR, a ratio, and the safety endpoint watches
position and impression volume so a ranking shift cannot be misread as a snippet win.

**Grade of the underlying claim:** the truncation defect is *verified* (195 characters, counted).
The claim that a better snippet lifts CTR at this position is *untested* — that is the experiment.
