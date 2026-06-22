# Source Expansion — Free Forecaster Roster + Fair, Snow-Aware Scoring (Design Spec)

**Date:** 2026-06-22
**Status:** Approved design, pre-plan
**Milestone:** "Source Expansion" — a **data-pipeline** milestone, sibling to M3 (data-viz). Independent of
the M2/M3 presentation work; branches off `main`.

## Goal

Grow the accuracy tracker from 3 forecasters (Open-Meteo, Apple, Ray's) to a broad roster of **free,
automatable** weather services, and rework scoring into a **fair, snow-aware, transparent** methodology
that (a) grades every source by the same rules, (b) never rewards vagueness or incompleteness, (c) never
punishes precision, and (d) surfaces every data gap in a visible coverage index.

This deepens the thesis — *free services match/beat the paid one, and paid services gate or omit
low-cost detail* — with more evidence and a defensible method. **Presentation is M3** (separate); this
milestone changes data + scoring only.

## Scope

**In:**
- Add free forecasters (capture + normalization adapter each): keyless **NWS**, **Met.no**; keyed
  **OpenWeatherMap**, **WeatherAPI.com**, **Visual Crossing**, **Tomorrow.io**; **AccuWeather**
  (conditional on a real perpetual free tier).
- Refactor source ingestion into a **source registry + per-source adapter** pattern so the data side is
  genuinely N-source (no bespoke per-source blocks). Existing Open-Meteo / Apple / Ray's become adapters too.
- **Scoring redesign** in `compare.py` — the coupled fair model (below).
- **Snow as a first-class field** — split actuals + forecasts into rain (liquid) + snow (depth); stop
  mashing them into a single `precip_in` (fixes the old rainfall-only behavior).
- **Coverage index** — per-source matrix of which scoreable fields each publishes vs. withholds;
  persisted to data for M3 to render; generalizes the existing Ray's-precip caveat to all sources.
- **Re-score the season** under the new method (published numbers will shift).
- Secrets/workflow wiring: capture steps read keys from env; GitHub Actions repo secrets; a signup guide.

**Out:**
- **Google Weather** — real free tier needs a Google Cloud billing account + card-on-file (usage ≈ $0,
  but a card is required). Excluded per owner's no-card rule; trivially re-addable if the owner accepts a
  never-charged card.
- **Pirate Weather** — redundant (NOAA GFS/HRRR reformatted; already covered by NWS + Open-Meteo's GFS).
- **Apple WeatherKit** ($99/yr) — Apple is still captured via the iPhone Shortcut.
- All **presentation** (M3): charts, the coverage-matrix UI, scoreboard, sparklines, motion.
- Blog-content expansion (separate roadmap thread).

## Source roster

| Source | Auth | Free (no card) | Expected scoreable fields | Notes |
|---|---|---|---|---|
| Open-Meteo | none | ✅ | hi / lo / wind / rain / snow | existing; also the actuals source |
| Apple Weather | iPhone Shortcut | ✅ | hi / lo / wind / precip | existing; manual upload |
| Ray's Weather | scrape | n/a | hi / lo / wind / precip-text | existing; no numeric precip |
| **NWS** (weather.gov) | keyless | ✅ | hi / lo / wind / precip-prob / QPF / snow | `/points/{lat},{lon}` → gridpoint; US gov |
| **Met.no / Yr** | keyless (User-Agent) | ✅ | hi / lo / wind / precip-amount | CC-licensed; UA must identify the app + contact |
| **OpenWeatherMap** | API key | ✅ (standard tier) | hi / lo / wind / rain / snow | use 5-day/3-hr → aggregate to daily; **avoid One Call 3.0** (card) |
| **WeatherAPI.com** | API key | ✅ | hi / lo / wind / precip / snow / chance | `forecast.json` daily block |
| **Visual Crossing** | API key | ✅ | hi / lo / wind / precip / snow | 1000 records/day; strong history too |
| **Tomorrow.io** | API key | ⚠️ confirm | hi / lo / wind / precip | drop if signup requires a card |
| **AccuWeather** | API key | ⚠️ conditional | hi / lo / wind / precip | include only if a real free tier exists (not a 14-day trial) |

## Architecture

- **Adapters** — one normalizer per source (e.g. `scripts/sources/<name>.py`), each fetching its API and
  returning a common forecast dict:
  `{ high_f, low_f, wind_mph, precip_type, rain_in, snow_in, fields_provided: [...] }`.
  `fields_provided` drives BOTH scoring (forfeit absent fields) and the coverage index.
- **Source registry** — a single registered list of sources `{ key, label, free, auth, adapter }`.
  `compare.py` iterates the registry instead of bespoke per-source blocks. Open-Meteo / Apple / Ray's are
  refactored into adapters behind the same interface.
- **Capture** — each source's daily forecast written to
  `data/predictions/{date}/{source}_forecast.json` by a capture step in `daily_capture.yml`. Keyless
  sources run unconditionally; keyed sources run **only if their env key is present** and skip cleanly
  otherwise (a missing key never breaks the run).
- **Scoring** (`compare.py`) — the coupled model below; writes per-source score + coverage into
  `data/comparisons/{date}.json`; aggregates `scores.json` totals (already source-generic) + a coverage
  rollup.
- **Actuals** — Open-Meteo archive split into `rain_in` (liquid) + `snow_in` (depth); type derived.

## Scoring methodology — the coupled fair model

100 points, same categories for every source:

| Category | Max | Tolerance (full credit) | Beyond |
|---|---|---|---|
| High temp | 30 | within 2°F | −3 / °F |
| Low temp | 30 | within 2°F | −3 / °F |
| Wind | 20 | within 3 mph | −2 / mph |
| Precip — **Type** | 10 | correct call: none / rain / snow / mix | wrong type loses type points |
| Precip — **Amount** | 10 | rain: ±0.1″ · snow: **max(±1″, ±20%)** | graduated penalty beyond |

Rules:
- **Tolerance bands ⇒ precision is never punished** — right-to-the-tolerance is full credit; finer error
  is ignored (forecasting to the hundredth and being right to the tenth costs nothing).
- **Type vs. amount** — "rain showers" / "rain likely" counts as a rain *type* call (earns type points if
  correct) but, with no number, **forfeits the amount points**. Snow scored in **depth inches** (what
  users want), rain in **liquid inches**; mixed days score both.
- **Omission forfeits that category** — no number ⇒ 0 there. Incompleteness *lowers the score*; it is
  **never renormalized away**, so a source can't climb the board by telling you less. Partial commitment
  earns partial credit.
- **No invented values** — never substitute `0.0` for an un-forecast field (the existing Ray's-precip
  rule, generalized to all sources/fields).
- **Grades** (Right ≥75 / Meh 60–74 / Wrong <60) unchanged. `totals.{right,wrong,meh}` are **absolute
  grade-band counts, not per-day rankings** — keep that labeling honest everywhere (carried from the M2 fix).

Worked example — actual **Hi 84 / Lo 61 / Wind 6 / Rain 0.12″**:
- Open-Meteo (85/62/7/0.10″): 30 + 30 + 20 + 10(type) + 10(amount, within ±0.1″) = **100**.
- Ray's (80/58/5/"rain likely", no amount): 24 + 27 + 20 + 10(type) + 0(amount forfeited) = **81**.
Ray's loses legitimately (worse temps, forfeits the amount he won't commit to) — not zeroed, not rigged,
and the forfeit is disclosed in the coverage index.

## Coverage index

Per source per day (and aggregated): which scoreable fields were published —
`{ high, low, wind, precip_type, precip_amount_rain, precip_amount_snow }` → ✓/✗ — persisted into each
comparison and rolled up in `scores.json`. M3 renders this as the "what they report vs. withhold" matrix;
it's where *"the paid service won't even commit to a snow total"* is shown loudly. The penalty for
omission lives in the score (forfeiture); the index makes that penalty visible and defensible.

## Secrets & signup (owner action)

Keyed adapters read `os.environ[...]`; keys live in **GitHub Actions repo secrets** (never committed).

| Service | Signup | Secret name |
|---|---|---|
| OpenWeatherMap | openweathermap.org/api → free account → API keys (use standard tier; not One Call 3.0) | `OPENWEATHER_API_KEY` |
| WeatherAPI.com | weatherapi.com/signup.aspx → free | `WEATHERAPI_KEY` |
| Visual Crossing | visualcrossing.com/weather-api → Sign Up Free (no card) | `VISUALCROSSING_KEY` |
| Tomorrow.io | tomorrow.io/weather-api → start free (bail if it asks for a card) | `TOMORROW_API_KEY` |
| AccuWeather | developer.accuweather.com → register → create App (only if real free tier) | `ACCUWEATHER_API_KEY` |

Met.no needs no key — its required User-Agent is set to the public site domain
(`DavesSweater/1.0 (+https://davessweater.com)`). Captures skip any source whose key is absent.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| API field/unit variance across providers | Per-source adapter normalizes to the common dict; unit tests per adapter against sample payloads |
| Key provisioning depends on the owner | Keyless NWS + Met.no ship first; keyed sources activate on key-drop; missing key = skip, never fail |
| AccuWeather free tier may be trial-only | Include only if a real free tier exists; else drop (on-thesis) |
| Re-scoring shifts the published numbers | Expected; communicate; the relative story (free beats paid) holds |
| Snow actuals quality from Open-Meteo archive | Use `snowfall_sum` (depth); revisit when the M6 station lands |
| Forecast-vs-actuals circularity (Open-Meteo is both) | Keep new forecasters distinct from the actuals source; long-term fix is the M6 station |

## Acceptance criteria

1. Keyless **NWS** + **Met.no** captured daily and scored with no secrets.
2. Keyed adapters (OWM, WeatherAPI, Visual Crossing, Tomorrow.io, AccuWeather-if-free) implemented;
   each activates when its secret is set and **skips cleanly when absent**.
3. **Registry/adapter refactor**: adding a source = add an adapter + register it (no bespoke `compare.py` edits).
4. Scoring implements the coupled model: fixed 100-pt denominator; precip type (10) + amount (10);
   rain ±0.1″ / snow max(±1″,±20%) tolerances; omission-forfeit; partial credit; no invented values.
5. Snow is first-class: actuals + forecasts carry distinct rain (liquid) + snow (depth); no single mashed `precip_in`.
6. **Coverage index** persisted per source (fields published vs. withheld) for M3 to render.
7. Season re-scored under the new method; `scores.json` + comparisons regenerated; totals labeling stays
   honest (grade bands, not rankings).
8. **Unit tests** for the scoring model (snow, omission/forfeit, tolerance, partial credit, type calls)
   and for each adapter's normalization.
9. No presentation changes (M3 owns that). CI updated for the new captures + secrets.

## Spec location note

`planning/specs/` (not `docs/`, the Vercel output dir), per M1/M2.

## Branch / coordination note

This milestone branches off `main` and is independent of the M2 PR (`m2-redesign-spec`, PR #59). Both
touch `CHECKLIST.md`, so CHECKLIST reconciliation happens at merge time; this branch edits `scripts/`,
`compare.py`, `data/`, and `.github/workflows/` — minimal overlap with M2's `src/` changes.
