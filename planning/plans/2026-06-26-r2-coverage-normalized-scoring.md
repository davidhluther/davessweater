# R2 — Coverage-normalized scoring (audit risk register)

> Fixes audit finding **R2**: Ray is structurally capped at 90/100 because his forfeited precip-amount is
> summed as 0 against a fixed-100 denominator, inflating the promoted Open-Meteo−Ray gap ~28% (26.3 → ~19.0).
> Owner decision (2026-06-26): **renormalize** — score each source out of its own provided-fields max.

## Design

Each day, a source's score becomes `raw_points / max_available × 100`, where:
- `raw_points` = sum of the per-field points it actually earned (already `total` in `scoring.py`).
- `max_available` = sum of the `max` of the fields it **provided** (`scored: true` in the breakdown).

Per-field points/maxes are **unchanged**; only the denominator changes. Consequences:
- **Open-Meteo & Apple-fallback** provide all 5 fields every day → `max_available = 100` → normalized == raw →
  **provably unchanged** (the invariant to verify: Open-Meteo avg stays 91.66, Apple unchanged).
- **Ray** forfeits precip_amount on 110/110 days → `max_available = 90` (or 80 on the 2 days he also lacks
  precip_type) → his avg rises ~65.3 → ~72.7; the public gap becomes the honest ~19.
- The 7 gated new sources that forfeit fields also lift — no public impact (still gated), but their
  `scores.json` totals change.

Known property (acceptable, transparency-mitigated): a source is graded purely on what it provides, so an
incomplete-but-accurate forecast isn't penalized for incompleteness (this is the same fairness principle that
lets Ray forfeit amounts). Among the public three only Ray forfeits anything, so this only does the intended
~7-pt Ray correction. The CoverageMatrix already shows who provides what, so "graded on provided fields" is
visible. Revisit a min-coverage rule only if a thin source is ever promoted to the headline.

## Tasks

1. **`scripts/scoring.py` — `score_prediction`** (TDD):
   - Compute `max_available = sum(bd[f]["max"] for f in bd if bd[f]["scored"])`.
   - `raw = total` (existing sum of provided points). `score = round(raw / max_available * 100, 1)` if
     `max_available` else `0.0`. Grade from the **normalized** score.
   - Return `score` (normalized), plus new `raw_points` and `max_available`. Breakdown stays raw.
   - Factor the formula into a tiny helper `normalized_score(raw, max_available)` reused by the backfill.

2. **`tests/test_scoring.py`** — update expectations to the normalized contract:
   - `test_perfect_committed_forecast_scores_100` → still 100.0 (full coverage).
   - `test_vague_precip_forfeits_amount_not_zeroed` → 81 raw / 90 avail → **90.0** (was 81.0).
   - `test_omitted_wind_forfeits_its_category` → 80 raw / 80 avail → **100.0** (was 80.0).
   - Add: a perfect-but-amount-forfeited (Ray-shaped) forecast scores **100.0**, not 90; `raw_points`/
     `max_available` present and correct; `normalized_score` matches.

3. **History re-score** — `scripts/renormalize_history.py` (stdlib, one-off + re-runnable):
   - For each `data/comparisons/*.json`, for each source's `score`: recompute `raw_points` from the
     breakdown's scored points (idempotent — never trusts `score.score`), `max_available` from scored maxes,
     set `score.score` = normalized, `score.raw_points`, `score.max_available`, re-grade. Save.
   - Then rebuild `data/scores.json` via `compare._update_running_scores` semantics (or call it).
   - Re-export CSV (`export_scores_csv.py`).

4. **Site** (reads normalized numbers — mostly no logic change):
   - `src/lib/types.ts` — add `raw_points?: number; max_available?: number` to `Score`.
   - `src/components/ScoreBreakdown.tsx` — add a footer line making normalization visible:
     `Score: {raw_points} / {max_available} available → {score}` (reconciles the per-field rows with the
     header total; directly answers "you scored him out of 100 for a question he wasn't asked").
   - `src/app/right-wrong-ray/page.tsx` — rewrite the stale 2-line caption (currently "four fields … out of
     100") to the accurate model: five scored fields (high 30 / low 30 / wind 20 interval / precip type 10 /
     precip amount 10), **scored out of the fields each source provides** (partial overlap with R4).
   - `CLAUDE.md` — one note that scoring is coverage-normalized (prevents new doc drift; full R8 refresh separate).

5. **Verify** (audit mandate — adversarial):
   - `python` checks: Open-Meteo total_score/avg byte-identical pre/post; Apple unchanged; Ray avg ~72.7;
     `trackingPointGap` ~19; every source's entries reconcile with totals (`test_scores_consistency.py`).
   - `npm test` + `npm run build` green; `python -m pytest tests/` green.
   - Spawn an independent reviewer to re-derive the numbers and check the scoring change for fairness/bugs
     (as PR #67's final review did).

## Out of scope (separate register items)
- Full methodology page / route (R4), full CLAUDE.md interval+snow refresh (R8), capture monitoring (R3),
  gating UpcomingForecasts (R6). R2 only touches the caption enough to not contradict the new model.
