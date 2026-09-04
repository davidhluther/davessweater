# Fall leaf-color model

Dave's Sweater tracks 18 places across the High Country, from Wilkesboro at 1,001 ft
to Beech Mountain at 5,436 ft, with daily temperature capture. This model turns that
elevation spread into 18 predicted peak-color windows for the fall, published and
graded on the same terms as every forecast on the site. Every forecast is a claim
about tomorrow; a peak-color window is a claim about October, and we grade our own
the same way we grade the temperature calls.

**Two versions ship at once.** `leaf-v0-draft` is the July 2026 parameter set; the
windows it produced on 2026-07-26 (`data/leaf/predictions.json`) are frozen and are
graded in November exactly as published. `leaf-v1` is the calibrated set adopted at the
September 2026 refresh — see [Calibration](#calibration-leaf-v1). Both are graded, on
the same unchanged ruler, into separate scoreboards.

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
each town's mean daily September temperature from the Open-Meteo archive and compare it to
that town's own normal. A warm anomaly pushes the peak later, a cool one earlier.

| | v0-draft (frozen) | v1 (adopted Sep 2026) |
|---|---|---|
| Window | September 1–25 | full calendar September (1–25 on the provisional pass) |
| Normal | rolling, prior 6 years | fixed span, 2008–2025 |
| Coefficient | 1.5 days/°F (declared prior) | **1.80** days/°F fitted (1.65 on the Sep 1–25 pass) |
| Clamp | ±7 days | **±10** days |

The clamp is deliberate. Photoperiod and elevation own the prediction; temperature only
nudges. A town with no September data yet (the case any time the model runs before fall)
gets a zero thermal term and a pure elevation-climatology prediction, and its `basis`
field says exactly that. No signal is invented to fill the gap.

## Calibration (leaf-v1)

v0's thermal constants were declared first-guess priors with nothing behind them. v1
replaces them with fitted values, **calibrated against 18 years of published High Country
peak-color observations at a 3,300 ft reference elevation** (2008–2025, one year excluded
for Hurricane Helene, so n = 17 graded pairs). The training set is
`data/leaf/training/fcg-historical.json`; every number below is reproduced by
`python3 scripts/fit_leaf_v1.py`.

Two things about the ground truth matter before any number does. It is a **single
observer's judgment of landscape-scale peak**, declared weekly, so each date carries about
±3 days of intrinsic resolution. And it is at **one elevation** — it says nothing about
the lapse rate, which is why v1 does not touch it.

### Our instrument, their ground truth

The record publishes its own September mean temperatures. Ours come from the Open-Meteo
archive at Boone, which is the model's own thermal source. The two series **correlate but
do not interchange**: r = 0.80 (R² 0.64), mean offset −0.53 °F, mean absolute difference
1.11 °F, worst year 2.54 °F. That is too loose to borrow their temperatures.

So v1 pairs **our temperature series with their observed peaks**, and fits the
coefficient on that. This is the cleaner arrangement anyway: the constant then describes
the instrument the model actually reads. It also fits better — R² 0.673 on our series
against 0.617 on theirs, over the same 17 years.

### The fitted coefficient

| Regression | n | Slope (days/°F) | R² |
|---|---|---|---|
| Our series, full September | 17 | **1.798** | 0.673 |
| Our series, September 1–25 | 17 | **1.650** | 0.588 |
| Their series, full September | 17 | 1.902 | 0.617 |

The last row reproduces the source analysis's own published regression (1.9015, R² 0.62)
to three decimals, which is the check that the digitized training set is faithful.

v1 ships **1.80 days/°F** on the full month and **1.65** on the Sep 1–25 provisional pass.
The full month is the better predictor, and the model now runs both windows rather than
choosing (see [Two passes](#two-passes)).

### Leave-one-year-out validation

Refit on 16 years, predict the seventeenth, repeat. Mean absolute error, in days:

| Model | LOYO MAE (days) |
|---|---|
| Climatology only, no thermal term | 3.85 |
| OLS refit each fold | 2.61 |
| Fixed coefficient 1.0 | 2.76 |
| Fixed coefficient 1.5 (v0's prior) | 2.47 |
| **Fixed coefficient 1.8 (v1)** | **2.34** |
| Fixed coefficient 1.9 | 2.31 |

The thermal term earns its place: every coefficient beats climatology by more than a day.
Between 1.5, 1.8, and 1.9 the spread is 0.16 days — well inside the ground truth's own
±3-day resolution, so this validation does not really discriminate between them. v1 ships
the fitted value because it is the fitted value, not because LOYO proved it superior.

### The sensitivity that will not go away

Two anomalously warm years, 2018 and 2019, carry the relationship. Remove them:

| Regression | n | Slope | R² |
|---|---|---|---|
| Our series, full September, minus 2018/2019 | 15 | 1.102 | 0.354 |
| Their series, full September, minus 2018/2019 | 15 | 1.216 | 0.254 |

The source analysis says the same thing about its own data and calls the result
non-significant (p = .056). Ours degrades less but degrades. **The honest reading is that
the coefficient is anchored by two years out of seventeen.** A future season that is warm
and peaks on schedule is the observation that would break it, and it is worth watching for
rather than explaining away.

### The clamp: ±7 → ±10

v0 clamped the thermal shift at ±7 days on caution alone. Against the historical extremes,
at v1's coefficient and anomalies measured from our own long-term normal:

| Year | September anomaly | Implied shift | Observed shift | Clamped at 7 | Clamped at 10 |
|---|---|---|---|---|---|
| 2018 | +3.36 °F | +6.1 d | +7.5 d | +6.1 | +6.1 |
| 2016 | +3.87 °F | +7.0 d | +0.5 d | +7.0 | +7.0 |
| 2019 | +4.80 °F | +8.6 d | +12.5 d | **+7.0** | +8.6 |

2019 is the case that settles it. The model already **under**-predicts that year's delay
by four days; a ±7 clamp would truncate it further and make the single largest documented
miss larger on purpose. v1 clamps at **±10**. 2016 is the honest counterweight — a warm
September that peaked on schedule anyway, which the clamp cannot help with, because the
problem there is the coefficient, not the cap.

### The anchor stays

The observed mean peak at 3,300 ft is **October 16.5** (n = 17, sd 4.8 days). Walking that
up 1,700 ft at the model's declared 6.5 days/1,000 ft implies an anchor of **October 5.5**
at the 5,000 ft reference; restricted to 2017–2025 it implies **October 6.8**. v0 ships
October 6, which sits between them. It is unchanged in v1 — but it is now corroborated by
an independent 17-year record rather than by one gallery's caption.

### What the climatological normal had to change

The coefficient was fitted against anomalies from an 18-year mean. v0's normal is a
**6-year rolling** window, and at Boone that window (2020–2025, 62.88 °F) sits **1.30 °F
cooler** than the long-term mean (64.18 °F). Multiplying that offset by 1.80 days/°F is
about **2.3 days of delay every single year**, produced by nothing but the choice of
baseline. v1 therefore uses a **fixed 2008–2025 normal**, per town, computed from the same
Open-Meteo series. A coefficient and its baseline are one decision, not two.

### Tested and excluded: drought and precipitation

The source analysis regressed monthly precipitation totals, seasonal totals, cumulative
amounts, and the Palmer Drought Index against peak timing across the same 18 years, alone
and in combination with temperature, and found **no significant relationship** to *timing*.
Drought does plenty — early leaf drop, duller color — but it acts on quality and leaf
retention, not on when peak arrives.

**This is recorded here as a tested exclusion, not an oversight.** 2026 is a drought year
in the mountains and the temptation to add a drought term to the date model is obvious. No
such term belongs in it. If we ever want to use drought, it goes in a separately labeled,
separately graded quality or early-drop flag that never touches the predicted date.

### Two passes

The best thermal predictor is the full calendar month, but the Open-Meteo archive trails
about six days, so the full month is not readable until roughly October 6 — after peak at
the highest elevations. v1 resolves that by publishing twice rather than by compromising
the window:

| Pass | Runs | Window | Coefficient | File |
|---|---|---|---|---|
| Provisional | Sep 18–30 | Sep 1–25 | 1.65 | `data/leaf/predictions-v1-provisional.json` |
| Final | Oct 6–12 | full September | 1.80 | `data/leaf/predictions-v1.json` |

Both are published, and **both are graded separately**. A revised forecast that is only
graded after revision is not graded at all.

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

Each model version and pass writes its **own** file, and `predict_leaf.py` refuses to
overwrite an existing prediction file unless told to (`--allow-overwrite`), because a
published prediction file is a graded artifact.

| Version / pass | File | Status |
|---|---|---|
| `leaf-v0-draft` | `data/leaf/predictions.json` | frozen — the July 26 call, graded as published |
| `leaf-v1` provisional | `data/leaf/predictions-v1-provisional.json` | written in the Sep 18–30 gate |
| `leaf-v1` final | `data/leaf/predictions-v1.json` | written in the Oct 6–12 gate |

`/leaf` and the per-town pages read the newest file that exists, so the public forecast
moves to v1 at the September refresh while the July artifact stays untouched on disk.

Each file carries model version, generation timestamp, target year, and one
record per place with `peak_start` / `peak_center` / `peak_end`, the component breakdown
(reference date, elevation shift, thermal shift, the anomaly and its normal), and a plain
`basis` string naming how the number was reached. Records are sorted earliest-peak first,
so the elevation gradient reads top to bottom.

Build it with `python3 scripts/predict_leaf.py` — which runs the adopted model (`leaf-v1`)
and picks the pass the calendar can support. `--model-version` runs a specific parameter
set, `--pass` forces a pass, `--year` targets a different fall.

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
4. **Rescore.** `python3 scripts/score_leaf.py` joins the observations against **every**
   prediction file present and writes one scoreboard per file — `scores.json` for the
   frozen v0 call, `scores-v1-provisional.json` and `scores-v1.json` for the two v1
   passes. They are never merged: an average across two model versions is a number about
   neither, and the whole point of freezing v0 is to see which set of constants was
   closer. The daily capture workflow also runs it every morning, so a
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
- **The thermal term is coarse.** September mean temperature is a proxy for the real
  drivers (cool nights, warm sunny days, first frost, drought stress). v1's coefficient is
  fitted rather than guessed, but see the honest limits below for what that fit can and
  cannot claim.
- **Ground truth is human-judged.** No station reports a "peak-color" number. Grading in
  October means reading photo galleries and reports by eye, which is inherently softer than
  scoring a temperature against an archive.
- **Peak is a window, not an instant, and it lingers unevenly.** A fixed ±5-day window is a
  simplification; real peaks hold longer at valley elevations than the symmetric window
  implies.

## What leaf-v1 can and cannot claim

The calibration is a real improvement over a declared prior, and it is a small study. Both
halves belong in the same paragraph.

**It can claim:**

- The thermal term beats climatology out of sample. Leave-one-year-out MAE falls from 3.85
  days to 2.34 — better than a day of skill, on 17 held-out years.
- The direction and rough magnitude are independently corroborated. Two different
  temperature instruments over the same 17 years give 1.80 and 1.90 days/°F. A constant
  that used to rest on nothing now rests on two.
- The October 6 anchor is consistent with 17 years of observed peaks at a different
  elevation, walked through the model's own lapse rate.
- Drought and precipitation are excluded on evidence rather than on the grounds that no
  one tried.

**It cannot claim:**

- **n ≈ 18, and effectively n ≈ 2.** Remove the two anomalously warm years and R² falls
  from 0.67 to 0.35 on our series (0.62 → 0.25 on the published one, where the source
  calls it non-significant). Most of what the coefficient knows, it learned from 2018 and
  2019.
- **One elevation, one observer, one corridor.** Every training row is a single person's
  weekly judgment of peak in the Boone-to-Grandfather corridor at about 3,300 ft. The
  model applies its constants from 1,001 ft to 5,436 ft; nothing here validates that
  extrapolation, and nothing here touches the lapse rate that does the extrapolating.
- **The ground truth is coarser than the fit.** Weekly declarations carry roughly ±3 days
  of resolution, which is the same order as the differences between candidate
  coefficients. Reading 1.80 as meaningfully different from 1.5 or 1.9 overreads the data.
- **A warm September is not reliably a late peak.** 2016 ran +3.9 °F and peaked on
  schedule. The relationship is real on average and unreliable in any given year — which
  is precisely why the published window stays ±5 days.
- **Nothing here is interannual skill on OUR forecasts.** The fit is retrospective. The
  first honest test is the graded 2026 season, where v0 and v1 are scored separately
  against the same observations. That comparison is the point of freezing v0.

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
