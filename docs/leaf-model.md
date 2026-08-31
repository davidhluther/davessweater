# Fall leaf-color model (v0-draft)

Dave's Sweater tracks 18 places across the High Country, from Wilkesboro at 1,001 ft
to Beech Mountain at 5,436 ft, with daily temperature capture. This model turns that
elevation spread into 18 predicted peak-color windows for the fall, published and
graded on the same terms as every forecast on the site. Every forecast is a claim
about tomorrow; a peak-color window is a claim about October, and we grade our own
the same way we grade the temperature calls.

Status: draft, and published. The math runs, the hindcast checks out against documented
ground truth, and the scorer is built and tested. As of 2026-08-31 the per-town windows
render on every `/weather/{slug}` page, the cross-town view and this methodology are
public at `/leaf`, the predicted windows drive the leaf term in the tourism Busy-ness
Index, and the daily workflow refreshes the model inside a September date gate and
rescores it every morning. It is still a first live fall, and the page says so.

## The model in one line

    peak_center = Oct-6 anchor  +  elevation lapse  +  early-fall thermal anomaly

Three ingredients, in order of how much they move the answer.

### 1. Photoperiod is the clock

Daylength on a given calendar date is identical year to year, and it is the primary
trigger for senescence, the shutdown of chlorophyll that lets the underlying yellows,
oranges, and reds show. Because the clock is fixed, the base timing of peak is fixed
too. We encode it as a single anchor rather than modeling daylength per day: peak color
at about 5,000 ft lands the first week of October. That is well documented. Grandfather
Mountain's dated fall-color galleries put 5,000 ft-plus at peak the first week of
October in both 2024 and 2025, and the regional NC-mountains reports agree. We pin the
anchor to October 6, the center of that week.

### 2. Elevation sets the spatial gradient

Higher ground cools sooner, so it peaks sooner. The documented High Country pattern is a
peak "front" that descends roughly 1,000 to 1,500 ft per week through the season. Taking
the midpoint, about 1,250 ft per week, gives 5.6 days per 1,000 ft of drop. We use a
slightly steeper **6.5 days per 1,000 ft**, which also fits the observed gap between
Grandfather at 5,000 ft (early October) and Boone near 3,333 ft (mid-to-late October).

Lower elevation means a later peak, so the shift is positive as elevation falls below the
5,000 ft reference and negative above it. This is the dominant term and the one a reader
can check by hand against any two towns.

### 3. Temperature nudges earliness

A warm early autumn delays senescence; a cold snap or early frost advances it. We measure
each town's mean daily temperature over September 1–25 and compare it to that town's own
normal, the average of the same window over the prior six years, pulled from the
Open-Meteo archive. A warm anomaly pushes the peak later, a cool one earlier, at **1.5
days per °F**, hard-clamped to **±7 days**.

The clamp is deliberate. Photoperiod and elevation own the prediction; temperature only
nudges. A town with no September data yet (the case any time the model runs before fall)
gets a zero thermal term and a pure elevation-climatology prediction, and its `basis`
field says exactly that. No signal is invented to fill the gap.

## Inputs

- **Town registry.** `data/locations/locations.json` (17 towns) plus Boone, which lives
  at the legacy top-level paths. Each town brings a vetted coordinate and elevation.
- **Temperatures.** Open-Meteo's archive API (`archive-api.open-meteo.com/v1/archive`),
  daily max/min in °F, same source and parameters the rest of the pipeline uses. Pulls
  are cached per town under `data/leaf/inputs/{slug}.json`; a rerun reads the cache and
  refetches only when the cached range does not cover what it needs (`--refresh` forces
  it). Stdlib only, fail-soft: a network error leaves the cache untouched and the town
  degrades to climatology.

## Output

`data/leaf/predictions.json` — model version, generation timestamp, target year, and one
record per place with `peak_start` / `peak_center` / `peak_end`, the component breakdown
(reference date, elevation shift, thermal shift, the anomaly and its normal), and a plain
`basis` string naming how the number was reached. Records are sorted earliest-peak first,
so the elevation gradient reads top to bottom.

Build it with `python3 scripts/predict_leaf.py` (add `--year` to target a different fall).

## Grading

The scorer is built now so the rules are fixed before any 2026 observation lands — no
grading on a curve after the fact. A predicted window scores against an observed peak the
same shape the site scores temperature: a tolerance band earns full credit, then a linear
penalty.

- **Day error.** Absolute and signed (predicted center minus observed, so positive means
  we called it late).
- **Window hit.** Did our predicted window overlap the observed peak. For a single
  observed date this is "was the date inside our window."
- **Score, 0–100.** Full credit within **3 days** of the observed peak, then **−6 points
  per day** beyond that, floored at zero.
- **Grade.** Right / Meh / Wrong on the site's 90 / 75 / 60 / 40 thresholds.

Observed peak can be a single date or a start/end band from a grading source. The registry
names three: Grandfather Mountain's dated galleries (the high-elevation leading indicator),
High Country Host's elevation-banded weekly report, and WataugaOnline's Boone-elevation
report. All three are human-judged, not data feeds, so October grading reads them by eye
rather than scraping them.

### Grading in practice

The weekly loop, from **September 21 through November 9**:

1. **Monday, read all three sources.** They are listed in `data/events/registry.json`
   under `grading_sources` with `purpose: "leaf-model grading"`, which is the same list
   `/leaf` cites, so the page can never name a source the scorer was not pointed at.
2. **Record every new peak call** as an entry in `data/leaf/observations.json`. An entry
   names either one town (`slug`) or an elevation band (`applies_to_elevation_ft`),
   because the published reports describe the season by band rather than town by town; a
   band observation scores every tracked town inside it. `observed` is a single ISO date
   or a `{start, end}` range. `observed_on` is the day you read the source, which is not
   the day the color peaked. Two sources calling the same town differently both get
   recorded — they are scored as two rows on purpose, because averaging them before
   scoring would hide the disagreement.
3. **Never infer an observation from our own prediction**, and never record a reading
   whose source you did not actually open. An entry with no `source_id` is not an
   observation, and `tests/test_score_leaf.py` fails the suite if one appears.
4. **Rescore.** `python3 scripts/score_leaf.py` joins the two files and writes
   `data/leaf/scores.json`. The daily capture workflow also runs it every morning, so a
   committed observation shows up on `/leaf` on the next build without anyone doing
   anything else.
5. **Commit the observation and the score together**, so a number on the site always
   ships with the reading that produced it.

`/leaf` renders the empty state — "nothing is scored yet" — until the first observation
lands, and switches to the scoreboard on its own once `summary.scored_rows` is above
zero. The summary's **mean signed error** is the number to watch across seasons: mean
absolute error says how far off we were, and only the signed version says whether we run
systematically early or late, which is the one honest basis for changing a constant.

## Hindcast

Run it with `python3 scripts/predict_leaf.py --hindcast`. It grades the model at three
elevation bands for 2024 and 2025 against the documented peaks, pulling the real September
temperatures for each year's thermal term.

| Year | Band | Predicted center | Observed band | Day error | Window hit | Score |
|---|---|---|---|---|---|---|
| 2024 | 5,000 ft | Oct 3 | Oct 1–7 | 1 | yes | 100 |
| 2024 | 4,250 ft | Oct 8 | Oct 7–13 | 2 | yes | 100 |
| 2024 | 3,333 ft | Oct 14 | Oct 15–25 | 6 | yes | 82 |
| 2025 | 5,000 ft | Oct 3 | Oct 1–7 | 1 | yes | 100 |
| 2025 | 4,250 ft | Oct 8 | Oct 7–13 | 2 | yes | 100 |
| 2025 | 3,333 ft | Oct 14 | Oct 15–25 | 6 | yes | 82 |

Every band hit its window. The high and mid bands land within a day or two of center; the
Boone band scores lower because its documented peak is a wide ten-day span and the score
measures distance to that span's center. Both years ran about 2°F cool over early
September against the six-year normal, which pulled the predicted centers a few days
earlier, the thermal term behaving as designed.

**Read this honestly.** The public NC-mountains reports describe peak by elevation band in
the same language across years; they do not publish a year-specific calendar peak date. So
the hindcast confirms the model reproduces the documented elevation gradient and its rough
timing. It does not, and cannot from this ground truth, confirm interannual skill — whether
the model calls a warm year later than a cool one correctly, day for day. That test needs
the graded 2026 season and the ones after it. Valley peaks (around 1,000 ft) are documented
only as "late October and beyond," too vague to grade, and the hindcast records them
ungraded rather than inventing a target.

## Known limitations

- **One anchor, one lapse rate, statewide.** The gradient is a straight line. Real color
  fronts bend with aspect, slope, and forest composition — a north-facing cove turns before
  a south-facing ridge at the same elevation. v0 does not model any of that.
- **Species mix is ignored.** Maples, poplars, oaks, and birches peak on different
  schedules; a town's dominant species shifts its true peak. Not in the model.
- **The thermal term is coarse and untested for skill.** September mean temperature is a
  proxy for the real drivers (cool nights, warm sunny days, first frost, drought stress).
  Its coefficient and clamp are first-guess priors, corrected once graded seasons
  accumulate — the same "declared prior, corrected by grading" path the traffic model
  takes.
- **Ground truth is human-judged.** No station reports a "peak-color" number. Grading in
  October means reading photo galleries and reports by eye, which is inherently softer than
  scoring a temperature against an archive.
- **Peak is a window, not an instant, and it lingers unevenly.** A fixed ±5-day window is a
  simplification; real peaks hold longer at valley elevations than the symmetric window
  implies.

## Downstream: the Busy-ness Index

The tourism Busy-ness Index (`scripts/compute_busyness.py`) takes its leaf term straight
from this artifact. For each forecast date it computes the **share of tracked places whose
predicted window covers that date** and scales it to a 0–15 component, capped below the
lodging signals because those measure demand directly rather than predicting it.

This replaced a flat placeholder. The event registry used to carry a `leaf-season-2026`
row asserting "October 1 to November 1, uniformly," which could not distinguish the third
weekend of October from the first. The row still exists for its provenance but now carries
`superseded_by: data/leaf/predictions.json`, and the engine skips any season with that
field, so the same fact is never counted twice. The resulting curve rises from about 1
point in early October to roughly 12 around October 19 and falls away through early
November, which is the shape a flat date range could not produce.

## Where it goes next

The graded 2026 season is the first real test and the point of shipping the core early —
maximum validation runway. The remaining downstream consumer is traffic v2, where the same
predicted peak dates inform corridor load on the Parkway approaches and US-321 into
Blowing Rock. That one waits on the model proving itself against a live, graded fall.
