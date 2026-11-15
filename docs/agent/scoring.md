## Scoring System

`scripts/scoring.py:score_prediction()` (orchestrated by `compare.py`) — points per field:

| Category      | Max Points | Tolerance        | Penalty                |
|---------------|-----------|------------------|------------------------|
| High temp     | 30        | within 1°F = full | -3 pts per °F beyond  |
| Low temp      | 30        | within 1°F = full | -3 pts per °F beyond  |
| Wind speed    | 20        | within 3 mph = full | -2 pts per mph beyond (interval midpoint + a 0.5× range-width vagueness tax) |
| Precip        | 20        | **dry day:** predicted amount vs 0" scored over the full 20 (type & amount encode the same fact — no double count). **wet day:** 10 identification (exact form = 10; right category / wrong form = 4; trace-band none-vs-precip = 6) + 10 amount, snow-aware (rain ±0.1", snow ±max(1", 20%)) | amount rain -20/in, snow -2/in; amount **capped at 5** when a real form is misnamed; amount **forfeited** (0) when precip is named but the total is omitted |

**Scoring recalibration (2026-07-26):** the temperature full-credit window tightened from **2°F to 1°F**
(slope unchanged at -3 pts/°F — the owner chose the gentler register over -4), because a 2°F window let temperature
saturate ~60% of the scale and the automated sources became indistinguishable in the 90s. Separately, the old
precip **type (10)** + **amount (10)** fields were **merged into one 20-pt `precip` field** (`scoring.py:_precip_20`)
so a single wet/dry fact is never graded twice: on a dry day the whole 20 is the predicted amount scored against
zero; on a precip day it is 10-pt form identification + 10-pt amount, with the wrong-form cap and omission-forfeit
above. The **implied-zero** and **trace-band** rules below are preserved as sub-components of the merged field. The
breakdown/coverage key `precip_type`+`precip_amount` collapsed to a single `precip` key (coverage tracks whether the
numeric amount was answered — the old `precip_amount` semantics). Rescored across all history + every town via
`rescore_history.py`.

**Precip & the implied-zero rule (2026-06-30):** scored out of a fixed 100. A forecast of **"no precip"** is a
zero-inch amount forecast — scored as such, so a source that says "no rain" earns the amount points on dry days.
A forecast of rain/snow with **no stated total** forfeits the amount (scored as a miss) — a source can't gain by
leaving the hard field blank. Ray's Weather never gives numeric totals, so he earns amount credit on his
dry-forecast days and forfeits it on his wet-forecast days (the implied-zero is set in `compare.py:_to_contract`
when `precip_type == "none"`). This replaced the short-lived R2 coverage-normalization, which let a forecaster
outrank a more-accurate one purely by omitting the amount. Precip **type** follows the forecast's weather
category (a rain / storm / snow forecast counts as predicting precipitation even at 0" QPF, so a thunderstorm
isn't mislabeled "none"), which also keeps the Apple/Open-Meteo fallback scoring consistent (`compare.py:_to_contract`).

**Trace-band partial type credit (2026-07-18):** the type boundary (rain > 0.005", snow > 0.05") sits far below
the amount tolerances (0.1" / 1"), so a "none" forecast on a trace day used to score 0/10 on type beside 10/10 on
amount — the same claim graded fully wrong and fully right at once (147 historical rows; owner-flagged 2026-07-02).
Fix: a none-vs-precip type disagreement earns **6/10** (`TYPE_TRACE_CREDIT` in `scoring.py:_type_points`) when the
precip side's amounts are inside the amount tolerances (`_is_trace`), in either direction. A source that names
precip but omits the total cannot claim the band (no gain by omission — Ray's wet-forecast days unchanged). Not
tuned against Ray: source-blind, lifted all 10 sources (+0.56 to +1.26 avg; Ray +0.56, Open-Meteo +1.08). History
rescored via `rescore_history.py`. This narrowed the trace incoherence only; the broader recalibration (merged
20-pt precip, temp-band tightening) shipped 2026-07-26 — see the recalibration note above. The trace-band credit
now lives inside the merged field as part of its 10-pt identification sub-score.

**Capture-day low recovery (2026-07-01):** Met.no and OpenWeatherMap derive the daily low as `min()` over their
sub-daily timeseries. On the capture day (~midday) that series no longer covers the pre-dawn hours, so its "low"
is the afternoon minimum — biased warm by 5–17°F, which depressed the low-temp score (30 of 100 pts)
on every one of those two sources' scored days. `compare.py:_fix_bucket_low` recovers the capture-day low from
the **day-ahead forecast issued the prior morning** (`predictions/{date-1}/{key}_forecast.json`, whose row for
that day spans the full (UTC) day and so reaches the overnight trough the midday capture missed), forfeiting the
low only when no prior capture exists. Sources reading a
provider daily-min (Open-Meteo, NWS, WeatherAPI, Visual Crossing, Tomorrow.io, Google) are unaffected. Applied
forward in the daily run and backfilled across history via `scripts/backfill_bucket_low.py`.

Grade thresholds (`_score_grade()`):
- 90+ → Right (5 rays)
- 75+ → Right (4 rays)
- 60+ → Meh (3 rays)
- 40+ → Wrong (2 rays)
- <40 → Wrong (1 ray)

## Sweater Weather Logic

`compare.py:is_sweater_weather()` — blends high and current temp:
- 75°F+ → No sweater (0 sweaters)
- 65-74 → No (1 sweater)
- 55-64 → Maybe (2 sweaters)
- 45-54 → Yes (3 sweaters)
- 35-44 → Yes (4 sweaters)
- <35 → Absolutely (5 sweaters)

